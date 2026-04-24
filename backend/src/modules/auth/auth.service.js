const jwt = require("jsonwebtoken");
const { User, USER_ROLES } = require("../users/models/user.model");
const { env } = require("../../config/env");
const {
  ValidationError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} = require("../../common/errors");
const { hashPassword, comparePassword, toSafeUser } = require("./auth.utils");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateRegisterPayload = (data) => {
  const { email, password, name, role } = data || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    throw new ValidationError("name is required.");
  }
  if (!email || typeof email !== "string" || !email.trim()) {
    throw new ValidationError("email is required.");
  }
  if (!EMAIL_REGEX.test(String(email).trim().toLowerCase())) {
    throw new ValidationError("email must be a valid email address.");
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new ValidationError("password is required and must be at least 8 characters.");
  }
  if (!role || !USER_ROLES.includes(role)) {
    throw new ValidationError(`role must be one of: ${USER_ROLES.join(", ")}.`);
  }
  return {
    email: String(email).trim().toLowerCase(),
    password,
    name: name.trim(),
    role,
  };
};

class AuthService {
  async registerUser(data) {
    const { email, password, name, role } = validateRegisterPayload(data);

    const passwordHash = await hashPassword(password);
    try {
      const user = await User.create({
        name,
        email,
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

  async loginUser(email, password) {
    if (!email || !password) {
      throw new ValidationError("email and password are required.");
    }
    const normalized = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalized }).select("+passwordHash");
    if (!user) {
      throw new UnauthorizedError("Invalid email or password.");
    }
    if (user.status !== "active") {
      throw new UnauthorizedError("Account is not active.");
    }
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError("Invalid email or password.");
    }
    const token = this.generateToken(user);
    return { token, user: toSafeUser(user) };
  }

  generateToken(user) {
    const payload = {
      userId: String(user._id),
      role: user.role,
    };
    return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  }

  async getMe(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError("User not found.");
    return toSafeUser(user);
  }
}

module.exports = {
  AuthService,
};
