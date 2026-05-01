const mongoose = require("mongoose");

const lotPricingSchema = new mongoose.Schema(
  {
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      required: true,
      unique: true,
      index: true,
    },
    rates: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const LotPricing = mongoose.model("LotPricing", lotPricingSchema);

module.exports = { LotPricing };
