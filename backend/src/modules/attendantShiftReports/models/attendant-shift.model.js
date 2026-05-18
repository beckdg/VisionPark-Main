const mongoose = require("mongoose");

const SHIFT_STATUSES = ["active", "closed"];

const attendantShiftSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: SHIFT_STATUSES,
      required: true,
      default: "active",
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now, index: true },
    closedAt: { type: Date, default: null },
    shiftReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShiftReport",
      default: null,
    },
  },
  { timestamps: true, versionKey: "__v" }
);

attendantShiftSchema.index(
  { attendantId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
    name: "uniq_active_shift_per_attendant",
  }
);

attendantShiftSchema.index(
  { branchId: 1, startedAt: -1 },
  { name: "attendant_shift_branch_time_idx" }
);

const AttendantShift = mongoose.model("AttendantShift", attendantShiftSchema);

module.exports = {
  AttendantShift,
  SHIFT_STATUSES,
};
