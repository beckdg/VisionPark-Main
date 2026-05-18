const crypto = require("crypto");
const bcrypt = require("bcrypt");

const OTP_BCRYPT_ROUNDS = 10;

const generateOtpCode = () => {
  const num = crypto.randomInt(0, 1_000_000);
  return String(num).padStart(6, "0");
};

const hashOtp = async (otpCode) => {
  return bcrypt.hash(String(otpCode), OTP_BCRYPT_ROUNDS);
};

const compareOtp = async (otpCode, otpHash) => {
  if (!otpCode || !otpHash) return false;
  return bcrypt.compare(String(otpCode), otpHash);
};

module.exports = {
  generateOtpCode,
  hashOtp,
  compareOtp,
};
