const { EmailVerificationService } = require("./emailVerification.service");
const { AuthService } = require("../auth/auth.service");
const { toSafeUser } = require("../auth/auth.utils");

const emailVerificationService = new EmailVerificationService();
const authService = new AuthService();

const verifyEmailOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body || {};
    const user = await emailVerificationService.verifySignupOtp(email, otp);
    const token = authService.generateToken(user);
    return res.status(200).json({
      success: true,
      data: {
        token,
        user: toSafeUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const resendEmailOtp = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const result = await emailVerificationService.resendSignupOtp(email);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  verifyEmailOtp,
  resendEmailOtp,
};
