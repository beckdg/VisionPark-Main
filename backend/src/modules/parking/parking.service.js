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

  async listLots({ role, userId }) {
    if (role === "admin") {
      return ParkingLot.find({}).sort({ name: 1 }).lean();
    }
    if (role === "owner") {
      return ParkingLot.find({ ownerId: userId }).sort({ name: 1 }).lean();
    }
    if (role === "driver") {
      return ParkingLot.find({}).sort({ name: 1 }).lean();
    }
    throw new ParkingError("Only owners, admins, and drivers can list lots.", 403);
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

  async updateLot({ role, userId, lotId, payload }) {
    const lot = await ParkingLot.findById(lotId);
    if (!lot) throw new NotFoundError("Lot not found.");
    if (role === "owner" && String(lot.ownerId) !== String(userId)) {
      throw new ParkingError("You may only update your own lots.", 403);
    }
    if (role !== "owner" && role !== "admin") {
      throw new ParkingError("Only owners and admins can update lots.", 403);
    }

    const patch = {};
    if (payload?.name !== undefined) patch.name = payload.name;
    if (payload?.region !== undefined) patch.region = payload.region;
    if (payload?.city !== undefined) patch.city = payload.city;
    if (payload?.address !== undefined) patch.address = payload.address;
    if (payload?.location !== undefined) patch.location = payload.location;
    if (payload?.overstayMultiplier !== undefined) patch.overstayMultiplier = payload.overstayMultiplier;
    if (payload?.status !== undefined) patch.status = payload.status;
    if (payload?.isActive !== undefined) patch.status = payload.isActive === false ? "inactive" : "active";

    Object.assign(lot, patch);
    await lot.save();
    return lot;
  }

  async deleteLot({ role, userId, lotId }) {
    const lot = await ParkingLot.findById(lotId);
    if (!lot) throw new NotFoundError("Lot not found.");
    if (role === "owner" && String(lot.ownerId) !== String(userId)) {
      throw new ParkingError("You may only delete your own lots.", 403);
    }
    if (role !== "owner" && role !== "admin") {
      throw new ParkingError("Only owners and admins can delete lots.", 403);
    }

    await ParkingSpot.deleteMany({ lotId: lot._id });
    await ParkingZone.deleteMany({ lotId: lot._id });
    await ParkingLot.deleteOne({ _id: lot._id });
    return { deleted: true };
  }

  async listZones({ role, userId, lotId }) {
    if (!lotId) {
      throw new ValidationError("lotId is required.");
    }

    const lot = await ParkingLot.findById(lotId).select("ownerId");
    if (!lot) throw new NotFoundError("Lot not found.");

    if (role === "driver") {
      return ParkingZone.find({ lotId }).sort({ name: 1 }).lean();
    }
    if (role === "owner" && String(lot.ownerId) !== String(userId)) {
      throw new ParkingError("Only the lot owner can list zones for this lot.", 403);
    }
    if (role !== "owner" && role !== "admin") {
      throw new ParkingError("Only owners, admins, and drivers can list zones.", 403);
    }

    return ParkingZone.find({ lotId }).sort({ name: 1 }).lean();
  }

  async createZone(payload) {
    const { lotId, name, category = null } = payload;
    if (!lotId || !name) {
      throw new ValidationError("lotId and name are required.");
    }
    const paymentRate = Number(payload?.paymentRate);
    if (payload?.paymentRate === undefined || Number.isNaN(paymentRate) || paymentRate < 0) {
      throw new ValidationError("paymentRate is required and must be a non-negative number.");
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
      paymentRate,
      isActive: payload?.isActive !== false,
    });
  }

  async updateZone({ role, userId, zoneId, payload }) {
    const zone = await ParkingZone.findById(zoneId);
    if (!zone) throw new NotFoundError("Zone not found.");
    const lot = await ParkingLot.findById(zone.lotId).select("ownerId");
    if (!lot) throw new NotFoundError("Lot not found.");
    if (role === "owner" && String(lot.ownerId) !== String(userId)) {
      throw new ParkingError("You may only update zones in your own lots.", 403);
    }
    if (role !== "owner" && role !== "admin") {
      throw new ParkingError("Only owners and admins can update zones.", 403);
    }

    const patch = {};
    if (payload?.name !== undefined) patch.name = payload.name;
    if (payload?.allowedCategories !== undefined) patch.allowedCategories = payload.allowedCategories;
    if (payload?.isActive !== undefined) patch.isActive = payload.isActive;

    Object.assign(zone, patch);
    await zone.save();
    return zone;
  }

  async deleteZone({ role, userId, zoneId }) {
    const zone = await ParkingZone.findById(zoneId);
    if (!zone) throw new NotFoundError("Zone not found.");
    const lot = await ParkingLot.findById(zone.lotId).select("ownerId");
    if (!lot) throw new NotFoundError("Lot not found.");
    if (role === "owner" && String(lot.ownerId) !== String(userId)) {
      throw new ParkingError("You may only delete zones in your own lots.", 403);
    }
    if (role !== "owner" && role !== "admin") {
      throw new ParkingError("Only owners and admins can delete zones.", 403);
    }

    await ParkingSpot.deleteMany({ zoneId: zone._id });
    await ParkingZone.deleteOne({ _id: zone._id });
    return { deleted: true };
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
    const zone = await ParkingZone.findById(zoneId).select("paymentRate");
    if (!zone) {
      throw new NotFoundError("Zone not found.");
    }
    const zonePaymentRate = Number(zone.paymentRate);
    if (Number.isNaN(zonePaymentRate) || zonePaymentRate < 0) {
      throw new ValidationError("Zone paymentRate is invalid. Update zone configuration first.");
    }

    let spot;
    try {
      spot = await ParkingSpot.create({
        lotId,
        zoneId,
        spotCode,
        paymentRate: zonePaymentRate,
        allowedCategories,
        status: "free",
        derivationVersion: 0,
      });
    } catch (error) {
      if (error && error.code === 11000) {
        throw new ConflictError("A spot with this code already exists in this zone.");
      }
      throw error;
    }

    return this.updateSpotStatus(spot._id);
  }

  async listSpots({ role, userId, zoneId }) {
    if (!zoneId) {
      if (role === "admin" || role === "driver") {
        return ParkingSpot.find({}).sort({ spotCode: 1 }).lean();
      }
      throw new ValidationError("zoneId is required.");
    }

    const zone = await ParkingZone.findById(zoneId).select("lotId");
    if (!zone) throw new NotFoundError("Zone not found.");

    const lot = await ParkingLot.findById(zone.lotId).select("ownerId");
    if (!lot) throw new NotFoundError("Lot not found.");

    if (role === "owner" && String(lot.ownerId) !== String(userId)) {
      throw new ParkingError("Only the lot owner can list spots for this zone.", 403);
    }
    if (role !== "owner" && role !== "admin" && role !== "driver") {
      throw new ParkingError("Only owners, admins, and drivers can list spots.", 403);
    }

    return ParkingSpot.find({ zoneId }).sort({ spotCode: 1 }).lean();
  }

  async updateSpot({ role, userId, spotId, payload }) {
    const spot = await ParkingSpot.findById(spotId);
    if (!spot) throw new NotFoundError("Spot not found.");
    const lot = await ParkingLot.findById(spot.lotId).select("ownerId");
    if (!lot) throw new NotFoundError("Lot not found.");
    if (role === "owner" && String(lot.ownerId) !== String(userId)) {
      throw new ParkingError("You may only update spots in your own lots.", 403);
    }
    if (role !== "owner" && role !== "admin") {
      throw new ParkingError("Only owners and admins can update spots.", 403);
    }

    if (payload?.spotCode !== undefined) spot.spotCode = payload.spotCode;
    if (payload?.allowedCategories !== undefined) {
      spot.allowedCategories = Array.isArray(payload.allowedCategories)
        ? payload.allowedCategories.filter((item) => typeof item === "string" && item.trim())
        : [];
    }

    try {
      await spot.save();
    } catch (error) {
      if (error && error.code === 11000) {
        throw new ConflictError("A spot with this code already exists in this zone.");
      }
      throw error;
    }
    return spot;
  }

  async deleteSpot({ role, userId, spotId }) {
    const spot = await ParkingSpot.findById(spotId);
    if (!spot) throw new NotFoundError("Spot not found.");
    const lot = await ParkingLot.findById(spot.lotId).select("ownerId");
    if (!lot) throw new NotFoundError("Lot not found.");
    if (role === "owner" && String(lot.ownerId) !== String(userId)) {
      throw new ParkingError("You may only delete spots in your own lots.", 403);
    }
    if (role !== "owner" && role !== "admin") {
      throw new ParkingError("Only owners and admins can delete spots.", 403);
    }

    await ParkingSpot.deleteOne({ _id: spot._id });
    return { deleted: true };
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
