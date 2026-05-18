const { User } = require("../users/models/user.model");
const { EmailVerification } = require("./models/email-verification.model");
const { generateOtpCode, hashOtp, compareOtp } = require("./otp.utils");
const { sendOtpEmail } = require("./providers/brevo.provider");
const {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  TooManyRequestsError,
} = require("../../common/errors");

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_RESENDS_PER_HOUR = 5;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email).trim().toLowerCase();

class EmailVerificationService {
  async invalidateActiveOtps(userId, purpose = "signup") {
    await EmailVerification.updateMany(
      {
        userId,
        purpose,
        verified: false,
        invalidatedAt: null,
      },
      { $set: { invalidatedAt: new Date() } }
    );
  }

  async createAndSendSignupOtp(user) {
    const otpCode = generateOtpCode();
    const otpHash = await hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await this.invalidateActiveOtps(user._id, "signup");

    await EmailVerification.create({
      userId: user._id,
      email: user.email,
      otpHash,
      purpose: "signup",
      expiresAt,
      attempts: 0,
      maxAttempts: MAX_OTP_ATTEMPTS,
      verified: false,
    });

    await sendOtpEmail({
      toEmail: user.email,
      recipientName: user.name,
      otpCode,
    });

    return { expiresAt };
  }

  async assertResendAllowed(userId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await EmailVerification.countDocuments({
      userId,
      purpose: "signup",
      createdAt: { $gte: oneHourAgo },
    });
    if (recentCount >= MAX_RESENDS_PER_HOUR) {
      throw new TooManyRequestsError(
        "Too many verification requests. Please try again later."
      );
    }

    const latest = await EmailVerification.findOne({
      userId,
      purpose: "signup",
      verified: false,
    })
      .sort({ createdAt: -1 })
      .select("createdAt");

    if (latest) {
      const elapsed = Date.now() - latest.createdAt.getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new TooManyRequestsError(
          `Please wait ${waitSeconds} seconds before requesting a new code.`
        );
      }
    }
  }

  async resendSignupOtp(email) {
    if (!email || !EMAIL_REGEX.test(normalizeEmail(email))) {
      throw new ValidationError("A valid email address is required.");
    }

    const normalized = normalizeEmail(email);
    const user = await User.findOne({ email: normalized, role: "driver" });
    if (!user) {
      throw new NotFoundError("No pending driver account found for this email.");
    }
    if (user.emailVerified === true) {
      throw new ValidationError("This email is already verified. You can log in.");
    }

    await this.assertResendAllowed(user._id);
    await this.createAndSendSignupOtp(user);

    return {
      success: true,
      message: "A new verification code has been sent to your email.",
      email: normalized,
    };
  }

  async verifySignupOtp(email, otp) {
    if (!email || !EMAIL_REGEX.test(normalizeEmail(email))) {
      throw new ValidationError("A valid email address is required.");
    }
    if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
      throw new ValidationError("OTP must be a 6-digit code.");
    }

    const normalized = normalizeEmail(email);
    const otpCode = String(otp).trim();

    const user = await User.findOne({ email: normalized, role: "driver" });
    if (!user) {
      throw new UnauthorizedError("Invalid email or verification code.");
    }
    if (user.emailVerified === true) {
      throw new ValidationError("Email is already verified. Please log in.");
    }

    const record = await EmailVerification.findOne({
      userId: user._id,
      email: normalized,
      purpose: "signup",
      verified: false,
      invalidatedAt: null,
    })
      .sort({ createdAt: -1 })
      .select("+otpHash");

    if (!record) {
      throw new UnauthorizedError("Invalid email or verification code.");
    }

    if (record.expiresAt <= new Date()) {
      throw new UnauthorizedError("Verification code has expired. Please request a new one.");
    }

    if (record.attempts >= record.maxAttempts) {
      throw new ForbiddenError(
        "Too many failed attempts. Please request a new verification code."
      );
    }

    const isMatch = await compareOtp(otpCode, record.otpHash);
    if (!isMatch) {
      record.attempts += 1;
      await record.save();

      const remaining = record.maxAttempts - record.attempts;
      if (remaining <= 0) {
        throw new ForbiddenError(
          "Too many failed attempts. Please request a new verification code."
        );
      }
      throw new UnauthorizedError(
        `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
      );
    }

    record.verified = true;
    record.invalidatedAt = new Date();
    await record.save();

    await this.invalidateActiveOtps(user._id, "signup");

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    return user;
  }
}

module.exports = {
  EmailVerificationService,
  OTP_EXPIRY_MS,
  RESEND_COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
};
