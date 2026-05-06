const mongoose = require("mongoose");

const INCIDENT_STATUSES = ["pending", "under_review", "resolved", "escalated"];

const evidenceItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: null },
    type: { type: String, trim: true, default: "image" },
    source: { type: String, trim: true, default: "manual" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    createdByType: {
      type: String,
      enum: ["attendant", "system"],
      required: true,
      index: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
      ref: "User",
    },
    type: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: INCIDENT_STATUSES,
      default: "pending",
      required: true,
      index: true,
    },
    severity: { type: String, trim: true, default: "medium", index: true },
    description: { type: String, trim: true, default: null },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSession",
      default: null,
      index: true,
    },
    spotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSpot",
      default: null,
      index: true,
    },
    plate: { type: String, trim: true, default: null, index: true },
    evidence: { type: [evidenceItemSchema], default: [] },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

const Incident = mongoose.model("Incident", incidentSchema);

module.exports = {
  Incident,
  INCIDENT_STATUSES,
};
