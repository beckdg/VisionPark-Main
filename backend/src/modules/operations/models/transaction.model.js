const mongoose = require("mongoose");

const TRANSACTION_STATUSES = ["pending", "success", "failed", "refunded"];
const TRANSACTION_METHODS = ["chapa", "manual"];
const PAYMENT_PROVIDERS = ["telebirr", "visa", "cbe"];

const breakdownSchema = new mongoose.Schema(
  {
    baseFee: { type: Number, default: null },
    overstayFee: { type: Number, default: null },
    hours: { type: Number, default: null },
    multiplier: { type: Number, default: null },
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "ParkingSession",
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, trim: true, default: "ETB" },
    /** Prefer `chapa` | `manual` (new writes). Legacy values may still exist in DB. */
    method: { type: String, required: true, trim: true },
    /** Prefer `telebirr` | `visa` | `cbe` for manual rails; null for Chapa-only. */
    provider: { type: String, trim: true, default: null },
    breakdown: { type: breakdownSchema, default: null },
    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      required: true,
      default: "pending",
      index: true,
    },
    providerRef: { type: String, trim: true, default: null, index: true },
    idempotencyKey: { type: String, trim: true, required: true, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    completedAt: { type: Date, default: null },
    /** Pending Chapa (or other async) checkout must complete by this time. */
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, versionKey: "__v" }
);

transactionSchema.index(
  { sessionId: 1, idempotencyKey: 1 },
  { unique: true, name: "uniq_transaction_session_idempotency" }
);

/** At most one reservation_fee and one parking_fee success per session. */
transactionSchema.index(
  { sessionId: 1, "metadata.type": 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "success",
      "metadata.type": { $in: ["reservation_fee", "parking_fee"] },
    },
    name: "uniq_typed_fee_success_per_session",
  }
);

transactionSchema.index(
  { status: 1, expiresAt: 1 },
  { name: "transaction_pending_expiry_idx", partialFilterExpression: { status: "pending" } }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = {
  Transaction,
  TRANSACTION_STATUSES,
  TRANSACTION_METHODS,
  PAYMENT_PROVIDERS,
};
