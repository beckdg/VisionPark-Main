const mongoose = require("mongoose");

const ENFORCEMENT_STATUSES = ["active", "flagged", "clamped", "cleared"];

const enforcementSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ENFORCEMENT_STATUSES,
      required: true,
      default: "active",
      index: true,
    },
    targetType: {
      type: String,
      enum: ["plate", "session"],
      required: true,
      index: true,
    },
    plate: { type: String, trim: true, default: null, index: true },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSession",
      default: null,
      index: true,
    },
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      default: null,
      index: true,
    },
    spotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSpot",
      default: null,
      index: true,
    },
    reason: { type: String, trim: true, default: null },
    debtAmount: { type: Number, default: 0 },
    isWatchlist: { type: Boolean, default: false, index: true },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    clearedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: "__v" }
);

enforcementSchema.index(
  { plate: 1, status: 1 },
  {
    partialFilterExpression: { plate: { $exists: true, $type: "string" } },
    name: "enforcement_plate_status_idx",
  }
);

const Enforcement = mongoose.model("Enforcement", enforcementSchema);

module.exports = {
  Enforcement,
  ENFORCEMENT_STATUSES,
};
