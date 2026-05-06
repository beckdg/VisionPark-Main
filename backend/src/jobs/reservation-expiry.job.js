const { ParkingSession } = require("../modules/sessions/models/parking-session.model");
const { SessionService } = require("../modules/sessions/session.service");
const { logger } = require("../common/logger");
const { randomUUID } = require("crypto");

class ReservationExpiryJob {
  constructor() {
    this.sessionService = new SessionService();
    this.isRunning = false;
    this.maxRetriesPerSession = 2;
  }

  async runOnce() {
    const requestId = `job-reservation-expiry-${randomUUID()}`;
    if (this.isRunning) {
      logger.warn("Reservation expiry job skipped due to active lock", {
        module: "jobs.reservation-expiry",
        requestId,
      });
      return { scanned: 0, expired: 0, skipped: 0, errors: 0 };
    }

    this.isRunning = true;
    let scanned = 0;
    let expired = 0;
    let skipped = 0;
    let errors = 0;

    try {
      logger.info("Reservation expiry job started", {
        module: "jobs.reservation-expiry",
        requestId,
      });
      const now = new Date();
      const candidates = await ParkingSession.find({
        state: "reserved",
        expiresAt: { $lt: now },
      }).select("_id expiresAt");

      scanned = candidates.length;

      for (const session of candidates) {
        let attempt = 0;
        let completed = false;
        while (!completed && attempt < this.maxRetriesPerSession) {
          attempt += 1;
          try {
            await this.sessionService.expireSession({
              sessionId: session._id,
              idempotencyKey: `job-expire:${String(session._id)}:${new Date(
                session.expiresAt
              ).getTime()}`,
            });
            expired += 1;
            completed = true;
          } catch (error) {
            if (error?.statusCode === 409) {
              skipped += 1;
              completed = true;
            } else if (attempt >= this.maxRetriesPerSession) {
              errors += 1;
              logger.error("Reservation expiry failed after retries", {
                module: "jobs.reservation-expiry",
                requestId,
                sessionId: String(session._id),
                error,
              });
            }
          }
        }
      }
      logger.info("Reservation expiry job finished", {
        module: "jobs.reservation-expiry",
        requestId,
        scanned,
        expired,
        skipped,
        errors,
      });
    } finally {
      this.isRunning = false;
    }

    return { scanned, expired, skipped, errors };
  }
}

module.exports = {
  ReservationExpiryJob,
};
