const mongoose = require("mongoose");

const USER_ROLES = ["owner", "driver", "attendant", "admin"];
const USER_STATUSES = ["active", "suspended"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: USER_ROLES, index: true },
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

const User = mongoose.model("User", userSchema);

module.exports = {
  User,
  USER_ROLES,
  USER_STATUSES,
};
