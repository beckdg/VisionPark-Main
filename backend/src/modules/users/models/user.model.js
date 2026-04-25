const mongoose = require("mongoose");

const USER_ROLES = ["owner", "driver", "attendant", "admin"];
const USER_STATUSES = ["active", "suspended"];

const driverSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true, default: null },
    licensePlate: { type: String, trim: true, default: null },
    vehicleType: { type: String, trim: true, default: null },
    region: { type: String, trim: true, default: null },
    country: { type: String, trim: true, default: null },
    paymentMethod: { type: String, trim: true, default: null },
    paymentAccount: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const ownerSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true, default: null },
    companyName: { type: String, trim: true, default: null },
    tinNumber: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const attendantSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      default: null,
    },
    faydaId: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    shiftStart: { type: String, trim: true, default: null },
    shiftEnd: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    avatarUrl: { type: String, trim: true, default: null },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: USER_ROLES, index: true },
    driver: { type: driverSchema, default: null },
    owner: { type: ownerSchema, default: null },
    attendant: { type: attendantSchema, default: null },
    status: {
      type: String,
      enum: USER_STATUSES,
      required: true,
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1 }, { unique: true, name: "uniq_user_email" });
userSchema.index(
  { "driver.licensePlate": 1 },
  { name: "driver_license_plate_idx", sparse: true }
);

const User = mongoose.model("User", userSchema);

module.exports = {
  User,
  USER_ROLES,
  USER_STATUSES,
};
