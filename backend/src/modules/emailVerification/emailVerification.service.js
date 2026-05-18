const jwt = require("jsonwebtoken");
const { User } = require("../users/models/user.model");
const { EmailVerification } = require("./models/email-verification.model");
const { generateOtpCode, hashOtp, compareOtp } = require("./otp.utils");
const { sendOtpEmail } = require("./providers/brevo.provider");
const { hashPassword } = require("../auth/auth.utils");
const { validatePasswordStrength } = require("../auth/password.utils");
const { env } = require("../../config/env");
const {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  TooManyRequestsError,
} = require("../../common/errors");
const {
  OTP_PURPOSE_SIGNUP,
  OTP_PURPOSE_PASSWORD_RESET,
  OTP_EXPIRY_MS,
  RESEND_COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
  MAX_RESENDS_PER_HOUR,
  PASSWORD_RESET_TOKEN_EXPIRES_IN,
  EMAIL_REGEX,
  GENERIC_PASSWORD_RESET_MESSAGE,
  normalizeEmail,
} = require("./otp.constants");

class EmailVerificationService {
  async invalidateActiveOtps(userId, purpose) {
    await EmailVerification.updateMany(
      {
        userId,
        purpose,
        verified: false,
        invalidatedAt: null,
        consumedAt: null,
      },
      { $set: { invalidatedAt: new Date() } }
    );
  }

  async assertResendAllowed(userId, purpose) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await EmailVerification.countDocuments({
      userId,
      purpose,
      createdAt: { $gte: oneHourAgo },
    });
    if (recentCount >= MAX_RESENDS_PER_HOUR) {
      throw new TooManyRequestsError(
        "Too many requests. Please try again later."
      );
    }

    const latest = await EmailVerification.findOne({
      userId,
      purpose,
      verified: false,
      consumedAt: null,
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

  async createAndSendOtp(user, purpose) {
    const otpCode = generateOtpCode();
    const otpHash = await hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await this.invalidateActiveOtps(user._id, purpose);

    const record = await EmailVerification.create({
      userId: user._id,
      email: user.email,
      otpHash,
      purpose,
      expiresAt,
      attempts: 0,
      maxAttempts: MAX_OTP_ATTEMPTS,
      verified: false,
    });

    const templateKey = purpose === OTP_PURPOSE_PASSWORD_RESET ? "password_reset" : "signup";
    await sendOtpEmail({
      toEmail: user.email,
      recipientName: user.name,
      otpCode,
      templateKey,
    });

    return { expiresAt, recordId: record._id };
  }

  async findActiveOtpRecord(userId, email, purpose) {
    return EmailVerification.findOne({
      userId,
      email,
      purpose,
      verified: false,
      invalidatedAt: null,
      consumedAt: null,
    })
      .sort({ createdAt: -1 })
      .select("+otpHash");
  }

  async verifyOtpForPurpose({ email, otp, purpose, invalidMessage, invalidateOnSuccess = true }) {
    if (!email || !EMAIL_REGEX.test(normalizeEmail(email))) {
      throw new ValidationError("A valid email address is required.");
    }
    if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
      throw new ValidationError("OTP must be a 6-digit code.");
    }

    const normalized = normalizeEmail(email);
    const otpCode = String(otp).trim();
    const genericError =
      invalidMessage || "Invalid email or verification code.";

    const user = await User.findOne({ email: normalized });
    if (!user) {
      throw new UnauthorizedError(genericError);
    }

    const record = await this.findActiveOtpRecord(user._id, normalized, purpose);
    if (!record) {
      throw new UnauthorizedError(genericError);
    }

    if (record.expiresAt <= new Date()) {
      throw new UnauthorizedError(
        "Verification code has expired. Please request a new one."
      );
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
    if (invalidateOnSuccess) {
      record.invalidatedAt = new Date();
    }
    await record.save();

    return { user, record };
  }

  generatePasswordResetToken(user, otpRecord) {
    return jwt.sign(
      {
        userId: String(user._id),
        purpose: OTP_PURPOSE_PASSWORD_RESET,
        otpId: String(otpRecord._id),
      },
      env.jwtSecret,
      { expiresIn: PASSWORD_RESET_TOKEN_EXPIRES_IN }
    );
  }

  verifyPasswordResetToken(resetToken) {
    try {
      const decoded = jwt.verify(resetToken, env.jwtSecret);
      if (
        !decoded?.userId ||
        decoded.purpose !== OTP_PURPOSE_PASSWORD_RESET ||
        !decoded.otpId
      ) {
        throw new UnauthorizedError("Invalid or expired reset session.");
      }
      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError("Invalid or expired reset session.");
    }
  }

  assertPasswordStrength(password) {
    const message = validatePasswordStrength(password);
    if (message) {
      throw new ValidationError(message);
    }
  }

  // --- Signup (driver email verification) ---

  async createAndSendSignupOtp(user) {
    return this.createAndSendOtp(user, OTP_PURPOSE_SIGNUP);
  }

  async resendSignupOtp(email) {
    if (!email || !EMAIL_REGEX.test(normalizeEmail(email))) {
      throw new ValidationError("A valid email address is required.");
    }

    const normalized = normalizeEmail(email);
    const user = await User.findOne({ email: normalized, role: "driver" });
    if (!user) {
      throw new UnauthorizedError("Invalid email or verification code.");
    }
    if (user.emailVerified === true) {
      throw new ValidationError("This email is already verified. You can log in.");
    }

    await this.assertResendAllowed(user._id, OTP_PURPOSE_SIGNUP);
    await this.createAndSendSignupOtp(user);

    return {
      success: true,
      message: "A new verification code has been sent to your email.",
      email: normalized,
    };
  }

  async verifySignupOtp(email, otp) {
    const { user } = await this.verifyOtpForPurpose({
      email,
      otp,
      purpose: OTP_PURPOSE_SIGNUP,
      invalidateOnSuccess: true,
    });

    if (user.role !== "driver") {
      throw new UnauthorizedError("Invalid email or verification code.");
    }
    if (user.emailVerified === true) {
      throw new ValidationError("Email is already verified. Please log in.");
    }

    await this.invalidateActiveOtps(user._id, OTP_PURPOSE_SIGNUP);

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    return user;
  }

  // --- Password reset (all roles) ---

  async requestPasswordReset(email) {
    if (!email || !EMAIL_REGEX.test(normalizeEmail(email))) {
      throw new ValidationError("A valid email address is required.");
    }

    const normalized = normalizeEmail(email);
    const user = await User.findOne({ email: normalized, status: "active" });

    if (user) {
      await this.assertResendAllowed(user._id, OTP_PURPOSE_PASSWORD_RESET);
      await this.createAndSendOtp(user, OTP_PURPOSE_PASSWORD_RESET);
    }

    return {
      success: true,
      message: GENERIC_PASSWORD_RESET_MESSAGE,
      email: normalized,
    };
  }

  async resendPasswordResetOtp(email) {
    return this.requestPasswordReset(email);
  }

  async verifyPasswordResetOtp(email, otp) {
    const genericError = "Invalid email or verification code.";
    const { user, record } = await this.verifyOtpForPurpose({
      email,
      otp,
      purpose: OTP_PURPOSE_PASSWORD_RESET,
      invalidMessage: genericError,
      invalidateOnSuccess: false,
    });

    if (user.status !== "active") {
      throw new UnauthorizedError(genericError);
    }

    const resetToken = this.generatePasswordResetToken(user, record);

    return {
      resetToken,
      email: user.email,
    };
  }

  async resetPassword(resetToken, password) {
    this.assertPasswordStrength(password);

    const decoded = this.verifyPasswordResetToken(resetToken);
    const user = await User.findById(decoded.userId).select("+passwordHash");
    if (!user || user.status !== "active") {
      throw new UnauthorizedError("Invalid or expired reset session.");
    }

    const otpRecord = await EmailVerification.findById(decoded.otpId);
    if (
      !otpRecord ||
      otpRecord.purpose !== OTP_PURPOSE_PASSWORD_RESET ||
      !otpRecord.verified ||
      otpRecord.consumedAt
    ) {
      throw new UnauthorizedError("Invalid or expired reset session.");
    }

    if (otpRecord.expiresAt <= new Date()) {
      throw new UnauthorizedError("Reset session has expired. Please start again.");
    }

    user.passwordHash = await hashPassword(password);
    user.passwordChangedAt = new Date();
    await user.save();

    otpRecord.consumedAt = new Date();
    await otpRecord.save();

    await EmailVerification.updateMany(
      {
        userId: user._id,
        purpose: OTP_PURPOSE_PASSWORD_RESET,
        consumedAt: null,
      },
      { $set: { invalidatedAt: new Date(), consumedAt: new Date() } }
    );

    return {
      success: true,
      message: "Password has been reset successfully.",
    };
  }
}

module.exports = {
  EmailVerificationService,
  OTP_EXPIRY_MS,
  RESEND_COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
};
