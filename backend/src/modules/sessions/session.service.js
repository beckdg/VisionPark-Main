const { ParkingSession } = require("./models/parking-session.model");
const { Transaction } = require("../operations/models/transaction.model");
const { ParkingService } = require("../parking/parking.service");
const { TransactionService } = require("../operations/transactions/transaction.service");
const { User } = require("../users/models/user.model");
const { LotPricing } = require("../pricing/models/lot-pricing.model");
const { DEFAULT_HOURLY_RATE_ETB } = require("../pricing/pricing.constants");
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

  async #resolveRatePerHour({ driverId, lotId }) {
    const [driver, lotPricing] = await Promise.all([
      User.findById(driverId).select("driver.vehicleType").lean(),
      LotPricing.findOne({ lotId }).select("rates").lean(),
    ]);

    const vehicleCategory = String(driver?.driver?.vehicleType || "").trim();
    const ratesObj = lotPricing?.rates || {};

    const raw = vehicleCategory ? ratesObj?.[vehicleCategory] : undefined;
    const n = Number(raw);
    const ratePerHour = Number.isFinite(n) && n >= 0 ? n : DEFAULT_HOURLY_RATE_ETB;

    return {
      vehicleCategory: vehicleCategory || null,
      ratePerHour,
      source: vehicleCategory && Number.isFinite(n) ? "lot_pricing" : "default",
    };
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

    const closedAt = new Date();
    let parkingClosePatch;
    if (existing.state === "secured" && existing.securedAt) {
      const pricing = await this.#resolveRatePerHour({
        driverId: existing.driverId,
        lotId: existing.lotId,
      });
      const durationMs = Math.max(0, closedAt.getTime() - new Date(existing.securedAt).getTime());
      const hours = durationMs / (1000 * 60 * 60);
      const fee = Number((hours * pricing.ratePerHour).toFixed(2));
      parkingClosePatch = {
        parkingFeeEtb: fee,
        appliedHourlyRateEtb: pricing.ratePerHour,
        pricingRateSource: pricing.source || null,
      };
    } else {
      parkingClosePatch = {
        parkingFeeEtb: 0,
        appliedHourlyRateEtb: null,
        pricingRateSource: null,
      };
    }

    try {
      return await this.#transitionSession({
        sessionId,
        expectedState: ["secured", "expired"],
        nextState: "closed",
        action: "close_session",
        idempotencyKey,
        statePatch: { closedAt, closeReason, ...parkingClosePatch },
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

    const session = await ParkingSession.findOne(query)
      .sort({ updatedAt: -1, _id: -1 })
      .populate({ path: "spotId", select: "spotCode" })
      .populate({ path: "lotId", select: "name location" });
    if (!session) {
      throw new NotFoundError("No active session found.");
    }
    const pricing = await this.#resolveRatePerHour({
      driverId: session.driverId,
      lotId: session.lotId?._id || session.lotId,
    });
    const out = session.toObject();
    out.pricing = pricing;
    return out;
  }

  async getMySessions(driverId) {
    if (!driverId) {
      throw new ValidationError("driverId is required.");
    }

    const sessions = await ParkingSession.find({
      driverId,
      state: { $in: ["closed", "expired"] },
    })
      .sort({ createdAt: -1 })
      .populate({ path: "spotId", select: "spotCode" })
      .populate({
        path: "lotId",
        select: "name address city region ownerId location",
        populate: { path: "ownerId", select: "name owner" },
      })
      .lean();

    const sessionIds = sessions.map((s) => s._id);
    const transactions =
      sessionIds.length === 0
        ? []
        : await Transaction.find({ sessionId: { $in: sessionIds }, status: "success" })
            .sort({ createdAt: -1 })
            .lean();
    const txsBySessionId = new Map();
    for (const t of transactions) {
      const key = String(t.sessionId);
      if (!txsBySessionId.has(key)) txsBySessionId.set(key, []);
      txsBySessionId.get(key).push(t);
    }

    return Promise.all(
      sessions.map(async (s) => {
        const txs = txsBySessionId.get(String(s._id)) || [];
        const resTx = txs.find((t) => t.metadata?.type === "reservation_fee");
        const parkTx = txs.find((t) => t.metadata?.type === "parking_fee");
        const legacyTx = txs.find(
          (t) =>
            !t.metadata?.type ||
            (t.metadata.type !== "reservation_fee" && t.metadata.type !== "parking_fee")
        );

        const parkedAt = s.securedAt || null;
        const exitedAt = s.closedAt || s.expiredAt || null;
        const durationSeconds =
          parkedAt && exitedAt
            ? Math.max(0, Math.floor((new Date(exitedAt).getTime() - new Date(parkedAt).getTime()) / 1000))
            : null;

        const paymentMethod = parkTx?.method ?? resTx?.method ?? legacyTx?.method ?? null;
        const metaParkRaw = resTx?.metadata?.parkingAmount ?? resTx?.metadata?.usageFee;
        const metaPark =
          metaParkRaw != null && String(metaParkRaw).trim() !== "" && !Number.isNaN(Number(metaParkRaw))
            ? Number(metaParkRaw)
            : null;

        const storedParkingFee =
          s.parkingFeeEtb != null &&
          String(s.parkingFeeEtb).trim() !== "" &&
          Number.isFinite(Number(s.parkingFeeEtb))
            ? Number(s.parkingFeeEtb)
            : null;

        let reservationPaymentAmount = null;
        let parkingPaymentAmount = null;
        let parkingPaymentIsEstimate = false;

        if (parkTx) {
          parkingPaymentAmount = Number(parkTx.amount) || 0;
        }

        if (resTx) {
          reservationPaymentAmount = Number(resTx.amount) || 0;
          if (parkingPaymentAmount == null) {
            if (metaPark != null) {
              parkingPaymentAmount = metaPark;
            } else if (storedParkingFee != null) {
              parkingPaymentAmount = storedParkingFee;
            } else if ((s.state === "closed" || s.state === "expired") && durationSeconds != null && durationSeconds > 0) {
              const pricing = await this.#resolveRatePerHour({
                driverId: s.driverId,
                lotId: s.lotId?._id || s.lotId,
              });
              const rate = pricing.ratePerHour;
              if (rate > 0) {
                parkingPaymentAmount = Number(((durationSeconds / 3600) * rate).toFixed(2));
                parkingPaymentIsEstimate = true;
              } else {
                parkingPaymentAmount = 0;
              }
            } else {
              parkingPaymentAmount = 0;
            }
          }
        } else if (legacyTx) {
          reservationPaymentAmount = null;
          if (parkingPaymentAmount == null) {
            parkingPaymentAmount = Number(legacyTx.amount) || 0;
          }
        }

        const totalPaidAmount = txs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const hasReservationFlow = Boolean(resTx && (Number(resTx.amount) > 0));
        let sessionBillingTotal = null;
        if (hasReservationFlow && reservationPaymentAmount != null && parkingPaymentAmount != null) {
          sessionBillingTotal = Number(
            (Number(reservationPaymentAmount) + Number(parkingPaymentAmount)).toFixed(2)
          );
        } else if (parkTx && !resTx) {
          sessionBillingTotal = Number(parkTx.amount) || 0;
        } else if (legacyTx && !parkTx && !resTx) {
          sessionBillingTotal = Number(legacyTx.amount) || 0;
        } else if (txs.length) {
          sessionBillingTotal = Number(totalPaidAmount.toFixed(2));
        }

        const depositAmount =
          reservationPaymentAmount ??
          resTx?.metadata?.depositAmount ??
          resTx?.metadata?.reservationFee ??
          legacyTx?.metadata?.depositAmount ??
          legacyTx?.metadata?.reservationFee ??
          null;

        const ownerDoc = s.lotId?.ownerId;
        const company = ownerDoc?.owner?.companyName != null ? String(ownerDoc.owner.companyName).trim() : "";
        const ownerLegalName = ownerDoc?.name != null ? String(ownerDoc.name).trim() : "";
        const receiptMerchantName = company || ownerLegalName || null;

        const coords = s.lotId?.location?.coordinates;
        const lotLng = Array.isArray(coords) && coords.length >= 2 ? Number(coords[0]) : null;
        const lotLat = Array.isArray(coords) && coords.length >= 2 ? Number(coords[1]) : null;

        return {
          _id: s._id,
          spotCode: s?.spotId?.spotCode ?? null,
          branchName: s?.lotId?.name ?? null,
          lotName: s?.lotId?.name ?? null,
          lotAddress: s?.lotId?.address ?? null,
          lotCity: s?.lotId?.city ?? null,
          lotRegion: s?.lotId?.region ?? null,
          lotLatitude: Number.isFinite(lotLat) ? lotLat : null,
          lotLongitude: Number.isFinite(lotLng) ? lotLng : null,
          receiptMerchantName,
          state: s.state,
          reservedAt: s.reservedAt ?? null,
          parkedAt,
          startTime: parkedAt,
          exitedAt,
          endTime: exitedAt,
          durationSeconds,
          reservationPaymentAmount,
          parkingPaymentAmount,
          parkingPaymentIsEstimate,
          totalPaidAmount,
          sessionBillingTotal,
          depositAmount,
          parkingAmount: parkingPaymentAmount,
          totalAmount: sessionBillingTotal ?? totalPaidAmount,
          paymentMethod,
          parkingFeeEtb: storedParkingFee,
          payment: {
            amount: totalPaidAmount,
            reservationAmount: reservationPaymentAmount,
            parkingAmount: parkingPaymentAmount,
            parkingAmountIsEstimate: parkingPaymentIsEstimate,
            sessionBillingTotal,
            paymentMethod,
          },
        };
      })
    );
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
