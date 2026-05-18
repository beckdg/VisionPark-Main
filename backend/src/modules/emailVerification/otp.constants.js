const OTP_PURPOSE_SIGNUP = "signup";
const OTP_PURPOSE_PASSWORD_RESET = "password_reset";

const OTP_PURPOSES = [OTP_PURPOSE_SIGNUP, OTP_PURPOSE_PASSWORD_RESET];

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_RESENDS_PER_HOUR = 5;
const PASSWORD_RESET_TOKEN_EXPIRES_IN = "15m";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_PASSWORD_RESET_MESSAGE =
  "If an account exists for this email, a password reset code has been sent.";

const normalizeEmail = (email) => String(email).trim().toLowerCase();

module.exports = {
  OTP_PURPOSE_SIGNUP,
  OTP_PURPOSE_PASSWORD_RESET,
  OTP_PURPOSES,
  OTP_EXPIRY_MS,
  RESEND_COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
  MAX_RESENDS_PER_HOUR,
  PASSWORD_RESET_TOKEN_EXPIRES_IN,
  EMAIL_REGEX,
  GENERIC_PASSWORD_RESET_MESSAGE,
  normalizeEmail,
};
