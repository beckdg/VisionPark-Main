const { ParkingLot } = require("./models/parking-lot.model");
const { ParkingZone } = require("./models/parking-zone.model");
const { ParkingSpot } = require("./models/parking-spot.model");
const { ParkingSession } = require("../sessions/models/parking-session.model");
const { domainEventBus, DOMAIN_EVENTS } = require("../operations/shared/domain-events");
const { AppError, ValidationError, NotFoundError, ConflictError } = require("../../common/errors");
const { logger } = require("../../common/logger");

class ParkingError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, "PARKING_ERROR");
  }
}

class ParkingService {
  #logAnomaly(message, context = {}) {
    // Lightweight anomaly logging for stabilization; replace with logger integration later.
    logger.warn(message, { module: "parking.service", ...context });
  }

  async createLot(payload) {
    const { ownerId, name, region, city, address } = payload;
    if (!ownerId || !name || !region || !city || !address) {
      throw new ParkingError(
        "ownerId, name, region, city, and address are required.",
        400
      );
    }
    const status = payload?.status || (payload?.isActive === false ? "inactive" : "active");
    return ParkingLot.create({
      ownerId,
      name,
      region,
      city,
      address,
      status,
      location: payload?.location || undefined,
      overstayMultiplier:
        payload?.overstayMultiplier !== undefined ? payload.overstayMultiplier : 1,
    });
  }

  async createZone(payload) {
    const { lotId, name, category = null } = payload;
    if (!lotId || !name) {
      throw new ValidationError("lotId and name are required.");
    }
    const allowedCategories = Array.isArray(payload?.allowedCategories)
      ? payload.allowedCategories.filter((item) => typeof item === "string" && item.trim())
      : category
        ? [String(category).trim()]
        : [];
    return ParkingZone.create({
      lotId,
      name,
      category,
      allowedCategories,
      isActive: payload?.isActive !== false,
    });
  }

  async createSpot(payload) {
    const { lotId, zoneId } = payload;
    const spotCode = payload?.spotCode || payload?.code;
    const category = payload?.category || null;
    if (!lotId || !zoneId || !spotCode) {
      throw new ValidationError("lotId, zoneId, and code are required.");
    }
    const allowedCategories = Array.isArray(payload?.allowedCategories)
      ? payload.allowedCategories.filter((item) => typeof item === "string" && item.trim())
      : category
        ? [String(category).trim()]
        : [];

    const spot = await ParkingSpot.create({
      lotId,
      zoneId,
      spotCode,
      allowedCategories,
      status: "free",
      derivationVersion: 0,
    });

    return this.updateSpotStatus(spot._id);
  }

  async setSpotBlocked(spotId, isBlocked) {
    const spot = await ParkingSpot.findById(spotId);
    if (!spot) throw new NotFoundError("Spot not found.");

    const nextBlocked = Boolean(isBlocked);
    if (spot.isBlocked !== nextBlocked) {
      spot.isBlocked = nextBlocked;
      await spot.save();
    }

    return this.updateSpotStatus(spotId, { source: "enforcement" });
  }

  async getSpotById(spotId) {
    const spot = await ParkingSpot.findById(spotId);
    if (!spot) throw new NotFoundError("Spot not found.");
    return spot;
  }

  // Single source-of-truth derivation:
  // blocked > secured session > reserved session > free
  async updateSpotStatus(spotId, options = {}) {
    const maxRetries = 2;
    const source = options.source || "unknown";

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const spot = await ParkingSpot.findById(spotId);
      if (!spot) throw new NotFoundError("Spot not found.");

      let derivedStatus = "free";
      let derivedFromSessionId = null;

      const activeSessions = await ParkingSession.find({
        spotId: spot._id,
        state: { $in: ["secured", "reserved"] },
      })
        .sort({ updatedAt: -1, _id: -1 })
        .select("_id state updatedAt");

      const securedSessions = activeSessions.filter((s) => s.state === "secured");
      const reservedSessions = activeSessions.filter((s) => s.state === "reserved");
      const securedSession = securedSessions[0];
      const reservedSession = reservedSessions[0];

      if (activeSessions.length > 1) {
        this.#logAnomaly("Multiple active sessions detected for one spot.", {
          source,
          spotId: String(spot._id),
          sessionIds: activeSessions.map((s) => String(s._id)),
          states: activeSessions.map((s) => s.state),
        });
      }
      if (securedSessions.length > 1 || reservedSessions.length > 1) {
        this.#logAnomaly("Inconsistent active-session lookup result for derivation.", {
          source,
          spotId: String(spot._id),
          securedCount: securedSessions.length,
          reservedCount: reservedSessions.length,
        });
      }

      if (spot.isBlocked) {
        derivedStatus = "blocked";
      } else if (securedSession) {
        derivedStatus = "occupied";
        derivedFromSessionId = securedSession._id;
      } else if (reservedSession) {
        derivedStatus = "reserved";
        derivedFromSessionId = reservedSession._id;
      }

      const statusDerivedAt = new Date();
      const shouldClearDerived = derivedStatus === "free" || derivedStatus === "blocked";
      const nextDerivedFromSessionId = shouldClearDerived ? null : derivedFromSessionId;

      const updatedSpot = await ParkingSpot.findOneAndUpdate(
        {
          _id: spot._id,
          __v: spot.__v,
          derivationVersion: spot.derivationVersion,
        },
        {
          $set: {
            status: derivedStatus,
            derivedFromSessionId: nextDerivedFromSessionId,
            statusDerivedAt,
          },
          $inc: { __v: 1, derivationVersion: 1 },
        },
        { new: true }
      );

      if (updatedSpot) {
        domainEventBus.emitEvent(
          DOMAIN_EVENTS.SPOT_STATUS_DERIVED,
          {
            spotId: String(updatedSpot._id),
            lotId: String(updatedSpot.lotId),
            zoneId: String(updatedSpot.zoneId),
            status: updatedSpot.status,
            derivedFromSessionId: updatedSpot.derivedFromSessionId
              ? String(updatedSpot.derivedFromSessionId)
              : null,
            source,
            at: new Date().toISOString(),
          },
          {
            eventId: `spot-status:${String(updatedSpot._id)}:${updatedSpot.status}:${updatedSpot.derivationVersion}`,
          }
        );

        await this.ensureSpotConsistency(updatedSpot._id);
        return updatedSpot;
      }

      this.#logAnomaly("Concurrent spot update during derivation.", {
        source,
        spotId: String(spot._id),
        attempt,
      });
    }

    throw new ConflictError("Spot was updated concurrently. Retry derivation.");
  }

  async ensureSpotConsistency(spotId) {
    const spot = await ParkingSpot.findById(spotId).select(
      "_id status isBlocked derivedFromSessionId"
    );
    if (!spot) throw new NotFoundError("Spot not found.");

    // Drift detection: blocked flag and status must agree.
    if ((spot.isBlocked && spot.status !== "blocked") || (!spot.isBlocked && spot.status === "blocked")) {
      this.#logAnomaly("Spot block/status mismatch detected. Re-deriving.", {
        spotId: String(spot._id),
        isBlocked: spot.isBlocked,
        status: spot.status,
      });
      await this.updateSpotStatus(spot._id, { source: "drift_block_mismatch" });
      return;
    }

    // Drift detection: derivedFromSessionId must match status semantics.
    if ((spot.status === "free" || spot.status === "blocked") && spot.derivedFromSessionId) {
      this.#logAnomaly("Stale derivedFromSessionId detected. Re-deriving.", {
        spotId: String(spot._id),
        status: spot.status,
        derivedFromSessionId: String(spot.derivedFromSessionId),
      });
      await this.updateSpotStatus(spot._id, { source: "drift_stale_derived_session" });
    }
  }
}

module.exports = {
  ParkingService,
  ParkingError,
};
