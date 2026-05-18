const express = require("express");
const controller = require("./auth.controller");
const { authenticate } = require("./auth.middleware");
const { authOtpRateLimit } = require("./auth-rate-limit.middleware");
const emailVerificationController = require("../emailVerification/emailVerification.controller");

const router = express.Router();

router.post("/register", controller.register);
router.post("/login", controller.login);
router.post(
  "/verify-email-otp",
  authOtpRateLimit,
  emailVerificationController.verifyEmailOtp
);
router.post(
  "/resend-email-otp",
  authOtpRateLimit,
  emailVerificationController.resendEmailOtp
);
router.post(
  "/forgot-password",
  authOtpRateLimit,
  emailVerificationController.forgotPassword
);
router.post(
  "/verify-password-reset-otp",
  authOtpRateLimit,
  emailVerificationController.verifyPasswordResetOtp
);
router.post(
  "/reset-password",
  authOtpRateLimit,
  emailVerificationController.resetPassword
);
router.post(
  "/resend-password-reset-otp",
  authOtpRateLimit,
  emailVerificationController.resendPasswordResetOtp
);
router.get("/me", authenticate, controller.me);
router.post("/complete-initial-password", authenticate, controller.completeInitialPassword);

module.exports = router;
