const mongoose = require("mongoose");
const { OTP_PURPOSES } = require("../otp.constants");

const emailVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    purpose: {
      type: String,
      enum: OTP_PURPOSES,
      required: true,
      default: "signup",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    verified: {
      type: Boolean,
      default: false,
      index: true,
    },
    invalidatedAt: {
      type: Date,
      default: null,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

emailVerificationSchema.index(
  { userId: 1, purpose: 1, verified: 1, invalidatedAt: 1, createdAt: -1 },
  { name: "otp_lookup_idx" }
);

emailVerificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "otp_ttl_idx" }
);

const EmailVerification = mongoose.model("EmailVerification", emailVerificationSchema);

module.exports = {
  EmailVerification,
  OTP_PURPOSES,
};
