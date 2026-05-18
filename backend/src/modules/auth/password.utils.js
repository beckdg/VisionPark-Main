const crypto = require("crypto");

const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";

const generateTemporaryPassword = (length = 12) => {
  let password = "";
  for (let i = 0; i < length; i += 1) {
    const idx = crypto.randomInt(0, TEMP_PASSWORD_CHARS.length);
    password += TEMP_PASSWORD_CHARS[idx];
  }
  return password;
};

const validatePasswordStrength = (password) => {
  if (!password || typeof password !== "string") {
    return "password is required.";
  }
  if (password.length < 8) {
    return "password must be at least 8 characters.";
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "password must include both uppercase and lowercase letters.";
  }
  if (!/\d/.test(password)) {
    return "password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "password must include at least one symbol.";
  }
  return null;
};

module.exports = {
  generateTemporaryPassword,
  validatePasswordStrength,
};
