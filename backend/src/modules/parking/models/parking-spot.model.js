const mongoose = require("mongoose");

const SPOT_STATES = ["free", "reserved", "occupied", "blocked"];

const parkingSpotSchema = new mongoose.Schema(
  {
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "ParkingLot",
    },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "ParkingZone",
    },
    spotCode: { type: String, required: true, trim: true },
    isBlocked: { type: Boolean, default: false, index: true },
    allowedCategories: { type: [String], default: [] },
    status: {
      type: String,
      enum: SPOT_STATES,
      required: true,
      default: "free",
      index: true,
    },
    derivedFromSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSession",
      default: null,
    },
    statusDerivedAt: { type: Date, default: Date.now },
    derivationVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: "__v",
  }
);

parkingSpotSchema.index(
  { lotId: 1, zoneId: 1, spotCode: 1 },
  { unique: true, name: "uniq_spot_code_within_zone" }
);

parkingSpotSchema.virtual("code")
  .get(function getCode() {
    return this.spotCode;
  })
  .set(function setCode(value) {
    this.spotCode = value;
  });

parkingSpotSchema.virtual("category")
  .get(function getCategory() {
    return this.allowedCategories?.[0] || null;
  })
  .set(function setCategory(value) {
    if (value == null || String(value).trim() === "") {
      this.allowedCategories = [];
      return;
    }
    this.allowedCategories = [String(value).trim()];
  });

parkingSpotSchema.set("toJSON", { virtuals: true });
parkingSpotSchema.set("toObject", { virtuals: true });

const ParkingSpot = mongoose.model("ParkingSpot", parkingSpotSchema);

const ensureParkingSpotIndex = async () => {
  try {
    const indexes = await ParkingSpot.collection.indexes();
    const uniqueIndex = indexes.find((idx) => idx.name === "uniq_spot_code_within_zone");
    if (!uniqueIndex) return;

    // Repair legacy index shape `{ lotId, zoneId, code }` that causes dup-key null failures.
    const hasLegacyCodeKey = Boolean(uniqueIndex.key?.code === 1);
    const hasSpotCodeKey = Boolean(uniqueIndex.key?.spotCode === 1);
    if (hasLegacyCodeKey && !hasSpotCodeKey) {
      await ParkingSpot.collection.dropIndex("uniq_spot_code_within_zone");
      await ParkingSpot.collection.createIndex(
        { lotId: 1, zoneId: 1, spotCode: 1 },
        { unique: true, name: "uniq_spot_code_within_zone" }
      );
    }
  } catch (error) {
    // Non-fatal; app should still boot even if index repair fails.
    // eslint-disable-next-line no-console
    console.warn("Parking spot index repair skipped:", error?.message || error);
  }
};

if (mongoose.connection.readyState === 1) {
  ensureParkingSpotIndex();
} else {
  mongoose.connection.once("open", ensureParkingSpotIndex);
}

module.exports = {
  ParkingSpot,
  SPOT_STATES,
};
