const mongoose = require("mongoose");

const AI_EXCEPTION_TYPES = ["UNREADABLE_PLATE", "EXIT_MISMATCH", "CATEGORY_MISMATCH"];
const AI_EXCEPTION_STATUSES = ["PENDING", "RESOLVED", "DISMISSED"];

const aiExceptionSchema = new mongoose.Schema(
  {
    exceptionCode: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      required: true,
      index: true,
    },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingZone",
      default: null,
      index: true,
    },
    spotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSpot",
      default: null,
      index: true,
    },
    cameraId: { type: String, trim: true, default: null, index: true },
    type: {
      type: String,
      enum: AI_EXCEPTION_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: AI_EXCEPTION_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },
    ai: {
      confidence: { type: Number, default: null },
      guessPlate: { type: String, trim: true, default: null },
      guessCategory: { type: String, trim: true, default: null },
      rawReason: { type: String, trim: true, default: null },
    },
    display: {
      locationLabel: { type: String, trim: true, default: null },
      issueText: { type: String, trim: true, default: null },
    },
    evidence: {
      imageUrl: { type: String, trim: true, default: null },
      snapshotAt: { type: Date, default: null },
    },
    resolution: {
      correctedPlate: { type: String, trim: true, default: null },
      correctedCategory: { type: String, trim: true, default: null },
      notes: { type: String, trim: true, default: null },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      resolvedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, versionKey: "__v" }
);

aiExceptionSchema.index(
  { lotId: 1, status: 1, createdAt: -1 },
  { name: "ai_exception_lot_status_created_idx" }
);

const AIException = mongoose.model("AIException", aiExceptionSchema);

module.exports = {
  AIException,
  AI_EXCEPTION_TYPES,
  AI_EXCEPTION_STATUSES,
};

