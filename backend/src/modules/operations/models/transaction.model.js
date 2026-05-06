const mongoose = require("mongoose");

const TRANSACTION_STATUSES = ["pending", "success", "failed", "refunded"];

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
    method: { type: String, required: true, trim: true },
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

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = {
  Transaction,
  TRANSACTION_STATUSES,
};
