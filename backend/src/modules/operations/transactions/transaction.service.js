const { Transaction } = require("../models/transaction.model");
const { ParkingSession } = require("../../sessions/models/parking-session.model");
const { domainEventBus, DOMAIN_EVENTS } = require("../shared/domain-events");
const { AppError, ValidationError, ConflictError, NotFoundError } = require("../../../common/errors");

class TransactionError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, "TRANSACTION_ERROR");
  }
}

class TransactionService {
  async getPaymentStabilityForSession(sessionId) {
    const [successfulCount, pendingCount] = await Promise.all([
      Transaction.countDocuments({ sessionId, status: "success" }),
      Transaction.countDocuments({ sessionId, status: "pending" }),
    ]);

    return {
      successfulCount,
      pendingCount,
      isStableForClosure: successfulCount === 1 && pendingCount === 0,
    };
  }

  async createPendingTransaction(payload) {
    const {
      sessionId,
      driverId,
      amount,
      currency = "ETB",
      method,
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

    const existing = await Transaction.findOne({ sessionId, idempotencyKey });
    if (existing) return existing;

    const alreadySuccessful = await Transaction.findOne({
      sessionId,
      status: "success",
    });
    if (alreadySuccessful) {
      throw new ConflictError("A successful transaction already exists for this session.");
    }

    try {
      return await Transaction.create({
        sessionId,
        driverId,
        amount,
        currency,
        method,
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
      const alreadySuccessful = await Transaction.findOne({
        sessionId: transaction.sessionId,
        status: "success",
        _id: { $ne: transaction._id },
      });
      if (alreadySuccessful) {
        throw new ConflictError("A successful transaction already exists for this session.");
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
