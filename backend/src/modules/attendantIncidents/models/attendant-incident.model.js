const mongoose = require("mongoose");

const ATTENDANT_INCIDENT_TYPES = [
  "Fled Without Payment",
  "Property Damage",
  "Customer Dispute",
  "Other",
];
const ATTENDANT_INCIDENT_STATUSES = ["pending", "resolved", "forwarded"];

const attendantIncidentMediaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["photo", "video"], required: true },
    name: { type: String, trim: true, default: null },
    data: { type: String, default: null },
    url: { type: String, trim: true, default: null },
    publicId: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const attendantIncidentSchema = new mongoose.Schema(
  {
    incidentCode: { type: String, required: true, unique: true, index: true },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      required: true,
      index: true,
    },
    attendantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    incidentType: { type: String, enum: ATTENDANT_INCIDENT_TYPES, required: true, index: true },
    offenderPlate: { type: String, trim: true, required: true, index: true },
    amount: { type: Number, default: null },
    description: { type: String, trim: true, required: true },
    damagedPlates: { type: [String], default: [] },
    media: { type: [attendantIncidentMediaSchema], default: [] },
    destination: { type: String, enum: ["owner", "debt_radar"], required: true, index: true },
    status: {
      type: String,
      enum: ATTENDANT_INCIDENT_STATUSES,
      required: true,
      default: "pending",
      index: true,
    },
    statusLabel: { type: String, trim: true, required: true },
  },
  { timestamps: true, versionKey: "__v" }
);

attendantIncidentSchema.index(
  { lotId: 1, createdAt: -1 },
  { name: "attendant_incident_lot_recent_idx" }
);

const AttendantIncident = mongoose.model("AttendantIncident", attendantIncidentSchema);

module.exports = {
  AttendantIncident,
  ATTENDANT_INCIDENT_TYPES,
  ATTENDANT_INCIDENT_STATUSES,
};

