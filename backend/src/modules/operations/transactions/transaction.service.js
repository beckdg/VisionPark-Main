const { Transaction } = require("../models/transaction.model");
const { ParkingSession } = require("../../sessions/models/parking-session.model");
const { domainEventBus, DOMAIN_EVENTS } = require("../shared/domain-events");
const {
  AppError,
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} = require("../../../common/errors");

const mapManualProvider = (paymentMethodLabel) => {
  const m = String(paymentMethodLabel || "").toLowerCase();
  if (m.includes("telebirr")) return "telebirr";
  if (m.includes("visa") || m.includes("master") || m.includes("card")) return "visa";
  if (m.includes("cbe")) return "cbe";
  return null;
};

const buildParkingBreakdown = (session) => {
  const securedAt = session?.securedAt;
  const closedAt = session?.closedAt;
  let hours = null;
  if (securedAt && closedAt) {
    const ms = Math.max(0, new Date(closedAt).getTime() - new Date(securedAt).getTime());
    hours = Number((ms / (1000 * 60 * 60)).toFixed(4));
  }
  const mult =
    session?.appliedHourlyRateEtb != null && Number.isFinite(Number(session.appliedHourlyRateEtb))
      ? Number(session.appliedHourlyRateEtb)
      : null;
  const base =
    session?.parkingFeeEtb != null && Number.isFinite(Number(session.parkingFeeEtb))
      ? Number(Number(session.parkingFeeEtb).toFixed(2))
      : null;
  return {
    baseFee: base,
    overstayFee: 0,
    hours,
    multiplier: mult,
  };
};

class TransactionError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, "TRANSACTION_ERROR");
  }
}

class TransactionService {
  async createTransactionForDriver(user, payload) {
    if (!user || user.role !== "driver") {
      throw new TransactionError("Only drivers can create transactions.", 403);
    }

    const sessionId = payload?.sessionId;
    const amount = Number(payload?.amount);
    const paymentMethod = String(payload?.paymentMethod || payload?.method || "").trim();
    const requestedStatus = String(payload?.status || "completed").toLowerCase();
    let resolvedType = String(payload?.type || payload?.transactionType || "")
      .trim()
      .toLowerCase();
    if (!resolvedType) resolvedType = "general";
    const idempotencyKey = String(
      payload?.idempotencyKey || `driver-manual:${user.userId}:${sessionId || "unknown"}`
    );

    if (!sessionId || Number.isNaN(amount) || amount < 0 || !paymentMethod) {
      throw new ValidationError("sessionId, amount, and paymentMethod are required.");
    }

    const session = await ParkingSession.findById(sessionId)
      .select("driverId state parkingFeeEtb securedAt closedAt appliedHourlyRateEtb")
      .lean();
    if (!session) throw new NotFoundError("Session not found.");
    if (String(session.driverId) !== String(user.userId)) {
      throw new ForbiddenError("You can only create transactions for your own sessions.");
    }

    if (
      (resolvedType === "general" || resolvedType === "") &&
      session.state === "closed"
    ) {
      const pf = session.parkingFeeEtb;
      if (pf != null && Number.isFinite(Number(pf)) && Math.abs(Number(amount) - Number(pf)) <= 0.02) {
        const parkingPaid = await Transaction.findOne({
          sessionId,
          status: "success",
          "metadata.type": "parking_fee",
        })
          .select("_id")
          .lean();
        if (!parkingPaid) {
          resolvedType = "parking_fee";
        }
      }
    }

    const isReservationFee = resolvedType === "reservation_fee";
    const isParkingFee = resolvedType === "parking_fee";
    if (isReservationFee) {
      if (!["reserved", "secured", "closed"].includes(session.state)) {
        throw new ConflictError(
          "Reservation fee can only be paid for reserved, secured, or closed sessions."
        );
      }
    } else if (isParkingFee) {
      if (session.state !== "closed") {
        throw new ConflictError("Parking fee can only be paid after the session is closed.");
      }
    } else if (session.state !== "closed") {
      throw new ConflictError("Transaction can only be created after session is closed.");
    }

    const normalizedStatus = requestedStatus === "completed" ? "success" : requestedStatus;
    if (normalizedStatus !== "success") {
      throw new ValidationError("status must be 'completed' or 'success'.");
    }
    if (isReservationFee && amount !== 100) {
      throw new ValidationError("Reservation fee transaction amount must be exactly 100 ETB.");
    }

    if (isParkingFee) {
      if (session?.parkingFeeEtb != null && Number.isFinite(Number(session.parkingFeeEtb))) {
        const expected = Number(session.parkingFeeEtb);
        if (Math.abs(Number(amount) - expected) > 0.02) {
          throw new ValidationError(
            `Parking fee must match the amount recorded at close (${expected} ETB).`
          );
        }
      }
    }

    const existing = await Transaction.findOne({ sessionId, idempotencyKey });
    if (existing) return existing;

    if (isReservationFee) {
      const dup = await Transaction.findOne({
        sessionId,
        status: "success",
        "metadata.type": "reservation_fee",
      });
      if (dup) return dup;
    } else if (isParkingFee) {
      const dup = await Transaction.findOne({
        sessionId,
        status: "success",
        "metadata.type": "parking_fee",
      });
      if (dup) return dup;
    } else {
      const legacyDup = await Transaction.findOne({
        sessionId,
        status: "success",
        $or: [
          { "metadata.type": { $exists: false } },
          { "metadata.type": null },
          { "metadata.type": "" },
          { "metadata.type": { $nin: ["reservation_fee", "parking_fee"] } },
        ],
      });
      if (legacyDup) {
        return legacyDup;
      }
    }

    const now = new Date();
    try {
      const metadata = isReservationFee
        ? { type: "reservation_fee" }
        : isParkingFee
          ? { type: "parking_fee" }
          : {};
      const breakdown = isParkingFee ? buildParkingBreakdown(session) : null;
      const created = await Transaction.create({
        sessionId,
        driverId: user.userId,
        amount,
        currency: "ETB",
        method: "manual",
        provider: mapManualProvider(paymentMethod),
        breakdown,
        status: "success",
        providerRef: null,
        idempotencyKey,
        metadata,
        completedAt: now,
      });

      if (isParkingFee) {
        await ParkingSession.findByIdAndUpdate(sessionId, {
          $set: { exitAllowed: true, paymentStatus: "paid" },
        });
      }

      domainEventBus.emitEvent(
        DOMAIN_EVENTS.TRANSACTION_COMPLETED,
        {
          transactionId: created._id,
          sessionId: created.sessionId,
          driverId: created.driverId,
          amount: created.amount,
          method: created.method,
          completedAt: created.completedAt,
        },
        {
          eventId: `transaction-completed:${String(created._id)}:${created.__v}`,
        }
      );

      return created;
    } catch (error) {
      if (error && error.code === 11000) {
        const byKey = await Transaction.findOne({ sessionId, idempotencyKey });
        if (byKey) return byKey;
        if (isReservationFee) {
          const r = await Transaction.findOne({
            sessionId,
            status: "success",
            "metadata.type": "reservation_fee",
          });
          if (r) return r;
        }
        if (isParkingFee) {
          const p = await Transaction.findOne({
            sessionId,
            status: "success",
            "metadata.type": "parking_fee",
          });
          if (p) return p;
        }
        const any = await Transaction.findOne({ sessionId, status: "success" });
        if (any) return any;
      }
      throw error;
    }
  }

  async getPaymentStabilityForSession(sessionId) {
    const [successfulCount, pendingCount] = await Promise.all([
      Transaction.countDocuments({ sessionId, status: "success" }),
      Transaction.countDocuments({ sessionId, status: "pending" }),
    ]);

    if (pendingCount > 0) {
      return { successfulCount, pendingCount, isStableForClosure: false };
    }

    let isStableForClosure = successfulCount === 1;

    const session = await ParkingSession.findById(sessionId).select("state paymentRequired").lean();
    if (session?.paymentRequired && session?.state === "closed" && successfulCount >= 1) {
      const reservationPaid = await Transaction.findOne({
        sessionId,
        status: "success",
        "metadata.type": "reservation_fee",
      })
        .select("_id")
        .lean();
      if (reservationPaid) {
        isStableForClosure = true;
      }
    }

    return {
      successfulCount,
      pendingCount,
      isStableForClosure,
    };
  }

  async createPendingTransaction(payload) {
    const {
      sessionId,
      driverId,
      amount,
      currency = "ETB",
      method,
      provider = null,
      breakdown = null,
      expiresAt = null,
      providerRef = null,
      idempotencyKey,
      metadata = {},
    } = payload;

    if (!sessionId || !driverId || !amount || !method || !idempotencyKey) {
      throw new TransactionError(
        "sessionId, driverId, amount, method, and idempotencyKey are required.",
        400
      );
    }

    const session = await ParkingSession.findById(sessionId);
    if (!session) throw new NotFoundError("Session not found.");
    if (String(session.driverId) !== String(driverId)) {
      throw new ConflictError(
        "Transaction driverId must match the session driver."
      );
    }

    const existing = await Transaction.findOne({ sessionId, idempotencyKey });
    if (existing) return existing;

    const feeType = metadata?.type;
    if (feeType === "reservation_fee" || feeType === "parking_fee") {
      const dup = await Transaction.findOne({
        sessionId,
        status: "success",
        "metadata.type": feeType,
      });
      if (dup) {
        throw new ConflictError(`A successful ${feeType} transaction already exists for this session.`);
      }
    } else {
      const alreadySuccessful = await Transaction.findOne({
        sessionId,
        status: "success",
      });
      if (alreadySuccessful) {
        throw new ConflictError("A successful transaction already exists for this session.");
      }
    }

    try {
      return await Transaction.create({
        sessionId,
        driverId,
        amount,
        currency,
        method,
        provider,
        breakdown,
        expiresAt,
        providerRef,
        idempotencyKey,
        metadata,
        status: "pending",
      });
    } catch (error) {
      if (error && error.code === 11000) {
        return Transaction.findOne({ sessionId, idempotencyKey });
      }
      throw error;
    }
  }

  async completeTransaction({ transactionId, status, providerRef = null, metadata = {} }) {
    if (!["pending", "success", "failed", "refunded"].includes(status)) {
      throw new ValidationError("Invalid transaction completion status.");
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) throw new NotFoundError("Transaction not found.");

    if (["success", "failed", "refunded"].includes(transaction.status)) {
      if (status === "pending") {
        throw new ConflictError(`Transaction already finalized as ${transaction.status}.`);
      }
      if (transaction.status !== status) {
        throw new ConflictError(`Transaction already finalized as ${transaction.status}.`);
      }
      return transaction;
    }

    if (status === "pending") {
      const updated = await Transaction.findByIdAndUpdate(
        transaction._id,
        {
          $set: {
            providerRef: providerRef || transaction.providerRef,
            metadata: { ...transaction.metadata, ...metadata },
          },
          $inc: { __v: 1 },
        },
        { new: true }
      );
      return updated;
    }

    if (status === "success") {
      const mergedMeta = { ...transaction.metadata, ...metadata };
      const feeType = mergedMeta?.type;
      let conflicting;
      if (feeType === "reservation_fee" || feeType === "parking_fee") {
        conflicting = await Transaction.findOne({
          sessionId: transaction.sessionId,
          status: "success",
          _id: { $ne: transaction._id },
          "metadata.type": feeType,
        });
      } else {
        conflicting = await Transaction.findOne({
          sessionId: transaction.sessionId,
          status: "success",
          _id: { $ne: transaction._id },
          $or: [
            { "metadata.type": { $exists: false } },
            { "metadata.type": null },
            { "metadata.type": "" },
            { "metadata.type": { $nin: ["reservation_fee", "parking_fee"] } },
          ],
        });
      }
      if (conflicting) {
        throw new ConflictError("A conflicting successful transaction already exists for this session.");
      }
    }

    const completedAt = new Date();
    let updated;
    try {
      updated = await Transaction.findOneAndUpdate(
        { _id: transaction._id, __v: transaction.__v, status: "pending" },
        {
          $set: {
            status,
            providerRef: providerRef || transaction.providerRef,
            metadata: { ...transaction.metadata, ...metadata },
            completedAt,
          },
          $inc: { __v: 1 },
        },
        { new: true }
      );
    } catch (error) {
      if (error && error.code === 11000 && status === "success") {
        throw new ConflictError("A successful transaction already exists for this session.");
      }
      throw error;
    }

    if (!updated) {
      const latest = await Transaction.findById(transaction._id);
      if (latest && latest.status === status) {
        return latest;
      }
      throw new ConflictError(
        "Transaction completion raced with another update. Retry with latest state."
      );
    }

    if (status === "success") {
      domainEventBus.emitEvent(DOMAIN_EVENTS.TRANSACTION_COMPLETED, {
        transactionId: updated._id,
        sessionId: updated.sessionId,
        driverId: updated.driverId,
        amount: updated.amount,
        method: updated.method,
        completedAt: updated.completedAt,
      }, {
        eventId: `transaction-completed:${String(updated._id)}:${updated.__v}`,
      });

      const merged = { ...transaction.metadata, ...metadata };
      if (merged?.type === "parking_fee") {
        await ParkingSession.findByIdAndUpdate(updated.sessionId, {
          $set: { exitAllowed: true, paymentStatus: "paid" },
        });
      }
    }

    return updated;
  }

  async hasSuccessfulTransactionForSession(sessionId) {
    const success = await Transaction.findOne({ sessionId, status: "success" }).select("_id");
    return Boolean(success);
  }

  async getById(transactionId) {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) throw new NotFoundError("Transaction not found.");
    return transaction;
  }
}

module.exports = {
  TransactionService,
  TransactionError,
};
