const mongoose = require("mongoose");

const parkingZoneSchema = new mongoose.Schema(
  {
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "ParkingLot",
    },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: null },
    allowedCategories: { type: [String], default: [] },
    paymentRate: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

parkingZoneSchema.index({ lotId: 1, name: 1 }, { unique: true, name: "uniq_lot_zone_name" });

const ParkingZone = mongoose.model("ParkingZone", parkingZoneSchema);

module.exports = { ParkingZone };
