const { ParkingSession } = require("../../sessions/models/parking-session.model");
const { ParkingSpot } = require("../../parking/models/parking-spot.model");
const { ParkingService } = require("../../parking/parking.service");
const { Enforcement } = require("../models/enforcement.model");
const { TransactionService } = require("../transactions/transaction.service");
const { logger } = require("../../../common/logger");

class ConsistencyAuditService {
  constructor() {
    this.parkingService = new ParkingService();
    this.transactionService = new TransactionService();
  }

  #logAnomaly(type, payload) {
    logger.warn(`Consistency audit anomaly: ${type}`, {
      module: "operations.consistency-audit",
      ...payload,
    });
  }

  async runAudit({ autoFixSafe = true } = {}) {
    const report = {
      sessionDrift: [],
      parkingDrift: [],
      enforcementDrift: [],
      transactionDrift: [],
    };

    await this.#auditSessionParkingConsistency(report, autoFixSafe);
    await this.#auditEnforcementParkingConsistency(report, autoFixSafe);
    await this.#auditTransactionSessionConsistency(report);

    return report;
  }

  async #auditSessionParkingConsistency(report, autoFixSafe) {
    const sessions = await ParkingSession.find({
      state: { $in: ["reserved", "secured", "expired", "closed"] },
    }).select("_id spotId state");

    for (const session of sessions) {
      const spot = await ParkingSpot.findById(session.spotId).select(
        "_id status isBlocked"
      );
      if (!spot) {
        const entry = {
          sessionId: String(session._id),
          spotId: String(session.spotId),
          issue: "spot_not_found_for_session",
          action: "none",
        };
        report.sessionDrift.push(entry);
        this.#logAnomaly("session_parking", entry);
        continue;
      }

      let expectedStatus = "free";
      if (spot.isBlocked) expectedStatus = "blocked";
      else if (session.state === "secured") expectedStatus = "occupied";
      else if (session.state === "reserved") expectedStatus = "reserved";

      if (spot.status !== expectedStatus) {
        const entry = {
          sessionId: String(session._id),
          spotId: String(spot._id),
          sessionState: session.state,
          currentSpotStatus: spot.status,
          expectedSpotStatus: expectedStatus,
          action: "none",
        };

        if (autoFixSafe) {
          await this.parkingService.updateSpotStatus(spot._id, {
            source: "audit_session_parking_fix",
          });
          entry.action = "spot_rederived";
        }

        report.sessionDrift.push(entry);
        this.#logAnomaly("session_parking", entry);
      }
    }
  }

  async #auditEnforcementParkingConsistency(report, autoFixSafe) {
    const enforcements = await Enforcement.find({
      status: { $in: ["active", "flagged", "clamped", "cleared"] },
      spotId: { $ne: null },
    }).select("_id status spotId");

    for (const enforcement of enforcements) {
      const spot = await ParkingSpot.findById(enforcement.spotId).select(
        "_id isBlocked status"
      );
      if (!spot) {
        const entry = {
          enforcementId: String(enforcement._id),
          spotId: String(enforcement.spotId),
          issue: "spot_not_found_for_enforcement",
          action: "none",
        };
        report.enforcementDrift.push(entry);
        this.#logAnomaly("enforcement_parking", entry);
        continue;
      }

      if (enforcement.status === "clamped" && !spot.isBlocked) {
        const entry = {
          enforcementId: String(enforcement._id),
          spotId: String(spot._id),
          enforcementStatus: enforcement.status,
          currentBlocked: spot.isBlocked,
          expectedBlocked: true,
          action: "none",
        };
        if (autoFixSafe) {
          await this.parkingService.setSpotBlocked(spot._id, true);
          entry.action = "spot_block_applied";
        }
        report.enforcementDrift.push(entry);
        this.#logAnomaly("enforcement_parking", entry);
      }

      if (enforcement.status === "cleared" && spot.isBlocked) {
        const blockingEnforcementCount = await Enforcement.countDocuments({
          _id: { $ne: enforcement._id },
          spotId: spot._id,
          status: { $in: ["active", "flagged", "clamped"] },
        });

        const entry = {
          enforcementId: String(enforcement._id),
          spotId: String(spot._id),
          enforcementStatus: enforcement.status,
          currentBlocked: spot.isBlocked,
          expectedBlocked: false,
          retainedByOtherEnforcement: blockingEnforcementCount > 0,
          action: "none",
        };

        if (autoFixSafe && blockingEnforcementCount === 0) {
          await this.parkingService.setSpotBlocked(spot._id, false);
          entry.action = "spot_unblock_applied";
        }

        report.enforcementDrift.push(entry);
        this.#logAnomaly("enforcement_parking", entry);
      }
    }

    const blockedSpots = await ParkingSpot.find({ isBlocked: true }).select("_id");
    for (const spot of blockedSpots) {
      const hasBlockingEnforcement = await Enforcement.exists({
        spotId: spot._id,
        status: { $in: ["active", "flagged", "clamped"] },
      });

      if (!hasBlockingEnforcement) {
        const entry = {
          spotId: String(spot._id),
          issue: "blocked_without_active_enforcement",
          action: "none",
        };
        if (autoFixSafe) {
          await this.parkingService.setSpotBlocked(spot._id, false);
          entry.action = "spot_unblock_applied";
        }
        report.parkingDrift.push(entry);
        this.#logAnomaly("parking_enforcement", entry);
      }
    }
  }

  async #auditTransactionSessionConsistency(report) {
    const closedSessions = await ParkingSession.find({ state: "closed" }).select(
      "_id paymentRequired"
    );

    for (const session of closedSessions) {
      if (!session.paymentRequired) continue;

      const paymentState = await this.transactionService.getPaymentStabilityForSession(
        session._id
      );
      if (!paymentState.isStableForClosure) {
        const entry = {
          sessionId: String(session._id),
          issue: "payment_inconsistent",
          paymentRequired: true,
          successfulCount: paymentState.successfulCount,
          pendingCount: paymentState.pendingCount,
          action: "log_only",
        };
        report.transactionDrift.push(entry);
        this.#logAnomaly("transaction_session", entry);
      }
    }
  }
}

module.exports = {
  ConsistencyAuditService,
};
