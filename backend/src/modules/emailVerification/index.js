const emailVerificationController = require("./emailVerification.controller");
const { EmailVerificationService } = require("./emailVerification.service");
const { EmailVerification } = require("./models/email-verification.model");

module.exports = {
  emailVerificationController,
  EmailVerificationService,
  EmailVerification,
};
