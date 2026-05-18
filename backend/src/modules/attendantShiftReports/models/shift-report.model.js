const mongoose = require("mongoose");

const shiftReportSchema = new mongoose.Schema(
  {
    attendantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      required: true,
      index: true,
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttendantShift",
      required: true,
      unique: true,
      index: true,
    },
    shiftStartedAt: { type: Date, required: true },
    shiftClosedAt: { type: Date, required: true },
    shiftDurationMinutes: { type: Number, required: true, min: 0 },

    totalWalkUps: { type: Number, required: true, min: 0 },
    totalTransactions: { type: Number, required: true, min: 0 },

    totalRevenue: { type: Number, required: true, min: 0 },
    expectedCashInHand: { type: Number, required: true, min: 0 },
    submittedCashInHand: { type: Number, required: true, min: 0 },
    cashDifference: { type: Number, required: true },

    cashPaymentsTotal: { type: Number, required: true, min: 0 },
    digitalPaymentsTotal: { type: Number, required: true, min: 0 },

    walkUpIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "WalkupCheckin" }],
    transactionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }],

    generatedAt: { type: Date, required: true, default: Date.now, index: true },
    notes: { type: String, trim: true, default: null },
  },
  { timestamps: true, versionKey: "__v" }
);

shiftReportSchema.index(
  { attendantId: 1, generatedAt: -1 },
  { name: "shift_report_attendant_time_idx" }
);

shiftReportSchema.index(
  { branchId: 1, generatedAt: -1 },
  { name: "shift_report_branch_time_idx" }
);

const ShiftReport = mongoose.model("ShiftReport", shiftReportSchema);

module.exports = {
  ShiftReport,
};
