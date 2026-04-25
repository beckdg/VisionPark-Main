const mongoose = require("mongoose");

const parkingLotSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },
    name: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [],
      },
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    overstayMultiplier: { type: Number, default: 1 },
  },
  { timestamps: true }
);

parkingLotSchema.index({ ownerId: 1, name: 1 }, { unique: true, name: "uniq_owner_lot_name" });
parkingLotSchema.index({ location: "2dsphere" }, { name: "parking_lot_location_2dsphere" });

parkingLotSchema.virtual("isActive")
  .get(function getIsActive() {
    return this.status === "active";
  })
  .set(function setIsActive(value) {
    this.status = value === false ? "inactive" : "active";
  });

parkingLotSchema.set("toJSON", { virtuals: true });
parkingLotSchema.set("toObject", { virtuals: true });

const ParkingLot = mongoose.model("ParkingLot", parkingLotSchema);

module.exports = { ParkingLot };
