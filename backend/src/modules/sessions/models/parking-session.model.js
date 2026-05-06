const mongoose = require("mongoose");

const SESSION_STATES = ["reserved", "secured", "expired", "closed"];

const idempotencyLogSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const parkingSessionSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "ParkingLot",
    },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "ParkingZone",
    },
    spotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "ParkingSpot",
    },
    state: {
      type: String,
      enum: SESSION_STATES,
      required: true,
      default: "reserved",
      index: true,
    },
    reservedAt: { type: Date, default: Date.now, required: true },
    securedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
    paymentRequired: { type: Boolean, default: false, index: true },
    closeReason: { type: String, trim: true, default: null },
    /** Usage fee at close (ETB), from lot pricing + parked duration — not zone/spot paymentRate. */
    parkingFeeEtb: { type: Number, default: null },
    appliedHourlyRateEtb: { type: Number, default: null },
    pricingRateSource: { type: String, trim: true, default: null },
    idempotencyLog: { type: [idempotencyLogSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: "__v",
  }
);

// Guard rail at storage-level: only one active occupancy-holding session per spot.
parkingSessionSchema.index(
  { spotId: 1 },
  {
    unique: true,
    partialFilterExpression: { state: { $in: ["reserved", "secured"] } },
    name: "uniq_active_session_per_spot",
  }
);

parkingSessionSchema.index(
  { "idempotencyLog.key": 1, "idempotencyLog.action": 1, driverId: 1 },
  { name: "idempotency_lookup_idx" }
);

const ParkingSession = mongoose.model("ParkingSession", parkingSessionSchema);

module.exports = {
  ParkingSession,
  SESSION_STATES,
};
