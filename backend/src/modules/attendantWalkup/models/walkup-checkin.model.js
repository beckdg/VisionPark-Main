const mongoose = require("mongoose");

const WALKUP_STATUSES = ["active", "completed", "cancelled"];

const walkupCheckinSchema = new mongoose.Schema(
  {
    transactionCode: { type: String, required: true, trim: true, index: true },
    receiptCode: { type: String, required: true, trim: true, index: true },
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
    licenceType: { type: String, required: true, trim: true },
    region: { type: String, default: null, trim: true },
    countryCode: { type: String, default: null, trim: true },
    platePrefix: { type: String, default: null, trim: true },
    plateInput: { type: String, required: true, trim: true },
    plateNumber: { type: String, required: true, trim: true, index: true },
    vehicleType: { type: String, required: true, trim: true },
    hourlyRate: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, required: true, trim: true, default: "cash" },
    status: {
      type: String,
      enum: WALKUP_STATUSES,
      required: true,
      default: "active",
      index: true,
    },
    checkedInAt: { type: Date, required: true, default: Date.now, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: "__v" }
);

walkupCheckinSchema.index(
  { lotId: 1, checkedInAt: -1 },
  { name: "walkup_checkin_lot_time_idx" }
);

walkupCheckinSchema.index(
  { attendantId: 1, checkedInAt: -1 },
  { name: "walkup_checkin_attendant_time_idx" }
);

walkupCheckinSchema.index(
  { transactionCode: 1 },
  { unique: true, name: "uniq_walkup_transaction_code" }
);

walkupCheckinSchema.index(
  { receiptCode: 1 },
  { unique: true, name: "uniq_walkup_receipt_code" }
);

const WalkupCheckin = mongoose.model("WalkupCheckin", walkupCheckinSchema);

module.exports = {
  WalkupCheckin,
  WALKUP_STATUSES,
};

