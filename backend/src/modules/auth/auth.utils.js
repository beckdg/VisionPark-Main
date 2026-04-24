const bcrypt = require("bcrypt");

const BCRYPT_ROUNDS = 12;

const hashPassword = async (plain) => {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
};

const comparePassword = async (plain, passwordHash) => {
  if (!plain || !passwordHash) return false;
  return bcrypt.compare(plain, passwordHash);
};

const toSafeUser = (userDoc) => {
  if (!userDoc) return null;
  const o = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete o.passwordHash;
  return o;
};

module.exports = {
  hashPassword,
  comparePassword,
  toSafeUser,
  BCRYPT_ROUNDS,
};
