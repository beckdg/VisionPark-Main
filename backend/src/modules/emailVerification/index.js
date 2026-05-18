const emailVerificationController = require("./emailVerification.controller");
const { EmailVerificationService } = require("./emailVerification.service");
const { EmailVerification } = require("./models/email-verification.model");
const otpConstants = require("./otp.constants");

module.exports = {
  emailVerificationController,
  EmailVerificationService,
  EmailVerification,
  otpConstants,
};
