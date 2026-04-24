const { User, USER_ROLES } = require("./models/user.model");
const { ValidationError, ConflictError, NotFoundError } = require("../../common/errors");
const { hashPassword, toSafeUser } = require("../auth/auth.utils");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class UserService {
  async createUser(payload) {
    const { name, email, role, password } = payload || {};

    if (!name || !email || !role || !password) {
      throw new ValidationError("name, email, role, and password are required.");
    }
    if (typeof password !== "string" || password.length < 8) {
      throw new ValidationError("password must be at least 8 characters.");
    }
    if (!USER_ROLES.includes(role)) {
      throw new ValidationError(
        `role must be one of: ${USER_ROLES.join(", ")}.`
      );
    }
    if (!EMAIL_REGEX.test(String(email).trim().toLowerCase())) {
      throw new ValidationError("email must be a valid email address.");
    }

    const passwordHash = await hashPassword(password);
    const normalizedEmail = String(email).trim().toLowerCase();

    try {
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        role,
        passwordHash,
        status: "active",
      });
      return toSafeUser(user);
    } catch (error) {
      if (error && error.code === 11000) {
        throw new ConflictError("A user with this email already exists.");
      }
      throw error;
    }
  }

  async getUserById(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found.");
    }
    return toSafeUser(user);
  }
}

module.exports = {
  UserService,
};
