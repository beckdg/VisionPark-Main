const mongoose = require("mongoose");

// Stores "instruct to leave" intent per attendant + spot.
// waitingToMove is computed from this record combined with the current spot state.
const attendantSpotLeaveInstructionSchema = new mongoose.Schema(
  {
    attendantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      required: true,
      index: true,
    },
    spotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSpot",
      required: true,
      index: true,
    },
    spotCode: { type: String, trim: true, required: true, index: true },

    waitingToMove: { type: Boolean, default: true, index: true },
    clearedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: "__v" }
);

attendantSpotLeaveInstructionSchema.index(
  { attendantId: 1, spotId: 1 },
  { unique: true, name: "uniq_attendant_spot_leave_instruction" }
);

const AttendantLiveGridLeaveInstruction = mongoose.model(
  "AttendantLiveGridLeaveInstruction",
  attendantSpotLeaveInstructionSchema
);

module.exports = {
  AttendantLiveGridLeaveInstruction,
};

