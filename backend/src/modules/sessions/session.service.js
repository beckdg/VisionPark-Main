const { ParkingSession } = require("./models/parking-session.model");
const { ParkingService } = require("../parking/parking.service");
const { TransactionService } = require("../operations/transactions/transaction.service");
const { domainEventBus, DOMAIN_EVENTS } = require("../operations/shared/domain-events");
const { AppError, ValidationError, ConflictError, NotFoundError } = require("../../common/errors");

class SessionError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, "SESSION_ERROR");
  }
}

class SessionService {
  constructor() {
    this.parkingService = new ParkingService();
    this.transactionService = new TransactionService();
  }

  #emitSessionEvent(sessionDoc) {
    const eventByState = {
      reserved: DOMAIN_EVENTS.SESSION_RESERVED,
      secured: DOMAIN_EVENTS.SESSION_SECURED,
      expired: DOMAIN_EVENTS.SESSION_EXPIRED,
      closed: DOMAIN_EVENTS.SESSION_CLOSED,
    };

    const eventName = eventByState[sessionDoc.state];
    if (!eventName) return;

    domainEventBus.emitEvent(
      eventName,
      {
        sessionId: String(sessionDoc._id),
        spotId: String(sessionDoc.spotId),
        driverId: String(sessionDoc.driverId),
        lotId: String(sessionDoc.lotId),
        zoneId: String(sessionDoc.zoneId),
        state: sessionDoc.state,
        at: new Date().toISOString(),
      },
      {
        eventId: `session-state:${String(sessionDoc._id)}:${sessionDoc.state}:${sessionDoc.__v}`,
      }
    );
  }

  async createReservation(payload) {
    const {
      driverId,
      lotId,
      zoneId,
      spotId,
      expiresAt,
      paymentRequired = false,
      idempotencyKey,
      closeReason = null,
    } = payload;

    if (!driverId || !lotId || !zoneId || !spotId || !expiresAt) {
      throw new SessionError(
        "driverId, lotId, zoneId, spotId, and expiresAt are required.",
        400
      );
    }

    const expiryDate = new Date(expiresAt);
    if (Number.isNaN(expiryDate.valueOf()) || expiryDate <= new Date()) {
      throw new ValidationError("expiresAt must be a valid future datetime.");
    }

    if (idempotencyKey) {
      const existingByKey = await ParkingSession.findOne({
        driverId,
        idempotencyLog: {
          $elemMatch: { key: idempotencyKey, action: "create_reservation" },
        },
      });

      if (existingByKey) {
        this.#emitSessionEvent(existingByKey);
        await this.parkingService.updateSpotStatus(existingByKey.spotId);
        return existingByKey;
      }
    }

    const active = await ParkingSession.findOne({
      spotId,
      state: { $in: ["reserved", "secured"] },
    });

    if (active) {
      throw new ConflictError("Spot already has an active session.");
    }

    try {
      const created = await ParkingSession.create({
        driverId,
        lotId,
        zoneId,
        spotId,
        expiresAt: expiryDate,
        paymentRequired: Boolean(paymentRequired),
        closeReason,
        idempotencyLog: idempotencyKey
          ? [{ key: idempotencyKey, action: "create_reservation" }]
          : [],
      });

      this.#emitSessionEvent(created);
      await this.parkingService.updateSpotStatus(created.spotId);
      return created;
    } catch (error) {
      if (error && error.code === 11000) {
        throw new SessionError(
          "Spot already has an active session (write conflict).",
          409
        );
      }
      throw error;
    }
  }

  async secureSession({ sessionId, idempotencyKey }) {
    return this.#transitionSession({
      sessionId,
      expectedState: "reserved",
      nextState: "secured",
      action: "secure_session",
      idempotencyKey,
      statePatch: { securedAt: new Date() },
    });
  }

  async expireSession({ sessionId, idempotencyKey }) {
    return this.#transitionSession({
      sessionId,
      expectedState: "reserved",
      nextState: "expired",
      action: "expire_session",
      idempotencyKey,
      statePatch: { expiredAt: new Date() },
    });
  }

  async closeSession({ sessionId, idempotencyKey, closeReason = "closed" }) {
    const existing = await this.getById(sessionId);
    if (existing.state === "closed") {
      this.#emitSessionEvent(existing);
      await this.parkingService.updateSpotStatus(existing.spotId, {
        source: "session_close_idempotent_closed_state",
      });
      return existing;
    }

    if (existing.paymentRequired) {
      const paymentState =
        await this.transactionService.getPaymentStabilityForSession(sessionId);
      if (!paymentState.isStableForClosure) {
        throw new SessionError(
          "Cannot close session until payment state is stable (exactly one success and no pending).",
          409
        );
      }
    }

    try {
      return await this.#transitionSession({
        sessionId,
        expectedState: ["secured", "expired"],
        nextState: "closed",
        action: "close_session",
        idempotencyKey,
        statePatch: { closedAt: new Date(), closeReason },
        preTransitionValidation: async () => {
          const latest = await ParkingSession.findById(sessionId).select(
            "state paymentRequired spotId"
          );
          if (!latest) throw new NotFoundError("Session not found.");
          if (latest.state === "closed") return { idempotentClosed: true, latest };
          if (latest.paymentRequired) {
            const paymentState =
              await this.transactionService.getPaymentStabilityForSession(sessionId);
            if (!paymentState.isStableForClosure) {
              throw new SessionError(
                "Cannot close session until payment state is stable.",
                409
              );
            }
          }
          return null;
        },
      });
    } catch (error) {
      const latest = await ParkingSession.findById(sessionId).select("state spotId");
      if (latest && latest.state === "closed") {
        this.#emitSessionEvent(latest);
        await this.parkingService.updateSpotStatus(latest.spotId, {
          source: "session_close_concurrency_recovery",
        });
        return latest;
      }
      throw error;
    }
  }

  async getById(sessionId) {
    const session = await ParkingSession.findById(sessionId);
    if (!session) {
      throw new NotFoundError("Session not found.");
    }
    return session;
  }

  async getActiveSessionForUser({ userId, role }) {
    if (!userId) {
      throw new ValidationError("userId is required.");
    }
    if (role !== "driver" && role !== "admin") {
      throw new SessionError("Only drivers and admins can query active session.", 403);
    }

    const query =
      role === "admin"
        ? { state: { $in: ["reserved", "secured"] } }
        : { driverId: userId, state: { $in: ["reserved", "secured"] } };

    const session = await ParkingSession.findOne(query).sort({ updatedAt: -1, _id: -1 });
    if (!session) {
      throw new NotFoundError("No active session found.");
    }
    return session;
  }

  async #transitionSession({
    sessionId,
    expectedState,
    nextState,
    action,
    idempotencyKey,
    statePatch = {},
    preTransitionValidation = null,
  }) {
    const session = await ParkingSession.findById(sessionId);
    if (!session) {
      throw new NotFoundError("Session not found.");
    }

    if (
      idempotencyKey &&
      Array.isArray(session.idempotencyLog) &&
      session.idempotencyLog.some(
        (entry) => entry.key === idempotencyKey && entry.action === action
      )
    ) {
      this.#emitSessionEvent(session);
      await this.parkingService.updateSpotStatus(session.spotId, {
        source: "session_transition_idempotent",
      });
      return session;
    }

    const expectedStates = Array.isArray(expectedState)
      ? expectedState
      : [expectedState];

    if (!expectedStates.includes(session.state)) {
      if (nextState === "closed" && session.state === "closed") {
        this.#emitSessionEvent(session);
        await this.parkingService.updateSpotStatus(session.spotId, {
          source: "session_transition_already_closed",
        });
        return session;
      }
      throw new SessionError(
        `Invalid transition from "${session.state}" to "${nextState}".`,
        409
      );
    }

    if (session.state === "reserved" && nextState !== "expired") {
      if (!session.expiresAt || new Date(session.expiresAt) <= new Date()) {
        throw new SessionError(
          "Reserved session has already reached expiry and cannot be secured/closed directly.",
          409
        );
      }
    }

    if (typeof preTransitionValidation === "function") {
      const validationResult = await preTransitionValidation();
      if (validationResult && validationResult.idempotentClosed && validationResult.latest) {
        this.#emitSessionEvent(validationResult.latest);
        await this.parkingService.updateSpotStatus(validationResult.latest.spotId, {
          source: "session_prevalidation_closed",
        });
        return validationResult.latest;
      }
    }

    const updated = await ParkingSession.findOneAndUpdate(
      {
        _id: session._id,
        __v: session.__v,
        state: { $in: expectedStates },
      },
      {
        $set: { state: nextState, ...statePatch },
        ...(idempotencyKey
          ? {
              $push: {
                idempotencyLog: {
                  key: idempotencyKey,
                  action,
                  at: new Date(),
                },
              },
            }
          : {}),
        $inc: { __v: 1 },
      },
      { new: true }
    );

    if (!updated) {
      throw new SessionError(
        "Session was updated concurrently. Retry operation.",
        409
      );
    }

    this.#emitSessionEvent(updated);
    await this.parkingService.updateSpotStatus(updated.spotId, {
      source: "session_transition_apply",
    });
    return updated;
  }
}

module.exports = {
  SessionService,
  SessionError,
};
