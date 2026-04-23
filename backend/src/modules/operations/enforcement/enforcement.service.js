const { Enforcement } = require("../models/enforcement.model");
const { ParkingSession } = require("../../sessions/models/parking-session.model");
const { ParkingService } = require("../../parking/parking.service");
const { domainEventBus, DOMAIN_EVENTS } = require("../shared/domain-events");
const { AppError, ValidationError, NotFoundError, ConflictError } = require("../../../common/errors");

class EnforcementError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, "ENFORCEMENT_ERROR");
  }
}

class EnforcementService {
  constructor() {
    this.parkingService = new ParkingService();
  }

  async createEnforcement(payload) {
    const {
      actionType,
      targetType,
      plate = null,
      sessionId = null,
      incidentId = null,
      spotId = null,
      reason = null,
      debtAmount = 0,
      isWatchlist = false,
      createdById = null,
    } = payload;

    if (actionType != null && actionType !== "" && actionType !== "clamp") {
      throw new ValidationError("actionType, if provided, must be clamp.");
    }

    if (!["plate", "session"].includes(targetType)) {
      throw new ValidationError("targetType must be plate or session.");
    }
    if (targetType === "plate" && !plate) {
      throw new ValidationError("plate is required when targetType is plate.");
    }
    if (targetType === "session" && !sessionId) {
      throw new ValidationError(
        "sessionId is required when targetType is session.",
      );
    }

    let resolvedSpotId = null;
    if (targetType === "session") {
      const session = await ParkingSession.findById(sessionId).select("spotId");
      if (!session) throw new NotFoundError("Session not found.");
      if (spotId && String(spotId) !== String(session.spotId)) {
        throw new ValidationError("spotId does not match this session's spot.");
      }
      resolvedSpotId = session.spotId;
    } else if (spotId) {
      resolvedSpotId = spotId;
    }

    if (actionType === "clamp" && !resolvedSpotId) {
      throw new ValidationError(
        "actionType clamp requires spotId (or session, which resolves the spot automatically).",
      );
    }

    const enforcement = await Enforcement.create({
      targetType,
      plate,
      sessionId,
      incidentId,
      spotId: resolvedSpotId,
      reason,
      debtAmount,
      isWatchlist,
      status: "active",
      createdById,
    });

    domainEventBus.emitEvent(DOMAIN_EVENTS.ENFORCEMENT_CREATED, {
      enforcementId: enforcement._id,
      status: enforcement.status,
      targetType: enforcement.targetType,
      plate: enforcement.plate,
      sessionId: enforcement.sessionId,
      incidentId: enforcement.incidentId,
      spotId: enforcement.spotId,
      at: new Date(),
    }, {
      eventId: `enforcement-created:${String(enforcement._id)}:${enforcement.__v}`,
    });

    let result = enforcement;
    if (resolvedSpotId) {
      const { enforcement: withBlock } = await this.applySpotBlock({
        enforcementId: enforcement._id,
        spotId: resolvedSpotId,
      });
      result = withBlock;
    }

    if (actionType === "clamp") {
      return this.clampEnforcement(result._id);
    }

    return result;
  }

  async flagEnforcement(enforcementId) {
    return this.#setStatus(enforcementId, "flagged", ["active"]);
  }

  async clampEnforcement(enforcementId) {
    return this.#setStatus(enforcementId, "clamped", ["active", "flagged"]);
  }

  async clearEnforcement(enforcementId) {
    return this.#setStatus(enforcementId, "cleared", ["active", "flagged", "clamped"]);
  }

  async applySpotBlock({ enforcementId, spotId }) {
    const enforcement = await Enforcement.findById(enforcementId);
    if (!enforcement) throw new NotFoundError("Enforcement record not found.");

    const targetSpotId = spotId || enforcement.spotId;
    if (!targetSpotId) {
      throw new ValidationError("spotId is required to apply a spot block.");
    }

    const currentSpot = await this.parkingService.getSpotById(targetSpotId);
    const alreadyBlocked = currentSpot.isBlocked === true;
    const spot = alreadyBlocked
      ? await this.parkingService.updateSpotStatus(targetSpotId, {
          source: "enforcement_idempotent_block",
        })
      : await this.parkingService.setSpotBlocked(targetSpotId, true);
    enforcement.spotId = targetSpotId;
    await enforcement.save();

    if (!alreadyBlocked) {
      domainEventBus.emitEvent(DOMAIN_EVENTS.ENFORCEMENT_BLOCK_APPLIED, {
        enforcementId: enforcement._id,
        spotId: targetSpotId,
        status: enforcement.status,
        at: new Date(),
      }, {
        eventId: `enforcement-block:${String(enforcement._id)}:${String(targetSpotId)}`,
      });
    }

    return { enforcement, spot };
  }

  async removeSpotBlock({ enforcementId, spotId }) {
    const enforcement = await Enforcement.findById(enforcementId);
    if (!enforcement) throw new NotFoundError("Enforcement record not found.");

    const targetSpotId = spotId || enforcement.spotId;
    if (!targetSpotId) {
      throw new ValidationError("spotId is required to remove a spot block.");
    }

    const currentSpot = await this.parkingService.getSpotById(targetSpotId);
    const alreadyUnblocked = currentSpot.isBlocked === false;
    const spot = alreadyUnblocked
      ? await this.parkingService.updateSpotStatus(targetSpotId, {
          source: "enforcement_idempotent_unblock",
        })
      : await this.parkingService.setSpotBlocked(targetSpotId, false);
    return { enforcement, spot };
  }

  async getById(enforcementId) {
    const enforcement = await Enforcement.findById(enforcementId);
    if (!enforcement) throw new NotFoundError("Enforcement record not found.");
    return enforcement;
  }

  async #setStatus(enforcementId, toStatus, fromStatuses) {
    const enforcement = await Enforcement.findById(enforcementId);
    if (!enforcement) throw new NotFoundError("Enforcement record not found.");

    if (!fromStatuses.includes(enforcement.status)) {
      throw new ConflictError(
        `Invalid enforcement transition from ${enforcement.status} to ${toStatus}.`,
      );
    }

    enforcement.status = toStatus;
    if (toStatus === "cleared") {
      enforcement.clearedAt = new Date();
      if (enforcement.spotId) {
        const spot = await this.parkingService.getSpotById(enforcement.spotId);
        if (spot.isBlocked) {
          await this.parkingService.setSpotBlocked(enforcement.spotId, false);
        } else {
          await this.parkingService.updateSpotStatus(enforcement.spotId, {
            source: "enforcement_clear_idempotent",
          });
        }
      }
    }
    await enforcement.save();
    return enforcement;
  }
}

module.exports = {
  EnforcementService,
  EnforcementError,
};
