const jwt = require("jsonwebtoken");
const { User, USER_ROLES } = require("../users/models/user.model");
const { env } = require("../../config/env");
const {
  ValidationError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} = require("../../common/errors");
const { hashPassword, comparePassword, toSafeUser } = require("./auth.utils");
const { validatePasswordStrength } = require("./password.utils");
const { EmailVerificationService } = require("../emailVerification/emailVerification.service");

const emailVerificationService = new EmailVerificationService();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DRIVER_PAYMENT_METHODS = new Set([
  "Telebirr",
  "CBE",
  "COOP",
  "Bank of Abyssinia",
]);

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim().length > 0;

const normalizeRoleInput = (data = {}) => {
  const normalized = { ...data };
  if (normalized.driverProfile && !normalized.driver) {
    normalized.driver = normalized.driverProfile;
  }
  if (normalized.ownerProfile && !normalized.owner) {
    normalized.owner = normalized.ownerProfile;
  }
  if (normalized.attendantProfile && !normalized.attendant) {
    normalized.attendant = normalized.attendantProfile;
  }
  if (normalized.attendant?.branchId && !normalized.attendant.lotId) {
    normalized.attendant.lotId = normalized.attendant.branchId;
  }
  return normalized;
};

const sanitizeRoleProfiles = (role, data = {}) => {
  const hasDriver = data.driver !== undefined;
  const hasOwner = data.owner !== undefined;
  const hasAttendant = data.attendant !== undefined;

  if (role === "driver") {
    if (!hasDriver || !data.driver || typeof data.driver !== "object") {
      throw new ValidationError("driver is required when role is driver.");
    }
    if (!hasValue(data.driver.licensePlate)) {
      throw new ValidationError(
        "driver.licensePlate is required when role is driver."
      );
    }
    if (hasOwner || hasAttendant) {
      throw new ValidationError("Only driver is allowed when role is driver.");
    }
    const pm = hasValue(data.driver.paymentMethod)
      ? String(data.driver.paymentMethod).trim()
      : "Telebirr";
    if (!DRIVER_PAYMENT_METHODS.has(pm)) {
      throw new ValidationError(
        `driver.paymentMethod must be one of: ${Array.from(DRIVER_PAYMENT_METHODS).join(", ")}.`
      );
    }
    const paymentAccountRaw = hasValue(data.driver.paymentAccount)
      ? String(data.driver.paymentAccount).trim()
      : null;
    return {
      driver: {
        phone: hasValue(data.driver.phone) ? String(data.driver.phone).trim() : null,
        licensePlate: String(data.driver.licensePlate).trim(),
        vehicleType: hasValue(data.driver.vehicleType)
          ? String(data.driver.vehicleType).trim()
          : null,
        region: hasValue(data.driver.region) ? String(data.driver.region).trim() : null,
        country: hasValue(data.driver.country) ? String(data.driver.country).trim() : null,
        paymentMethod: pm,
        paymentAccount: pm === "Telebirr" ? null : paymentAccountRaw,
      },
      owner: null,
      attendant: null,
    };
  }

  if (role === "owner") {
    if (!hasOwner || !data.owner || typeof data.owner !== "object") {
      throw new ValidationError("owner is required when role is owner.");
    }
    if (hasDriver || hasAttendant) {
      throw new ValidationError("Only owner is allowed when role is owner.");
    }
    return {
      driver: null,
      owner: {
        phone: hasValue(data.owner.phone) ? String(data.owner.phone).trim() : null,
        companyName: hasValue(data.owner.companyName)
          ? String(data.owner.companyName).trim()
          : null,
        tinNumber: hasValue(data.owner.tinNumber)
          ? String(data.owner.tinNumber).trim()
          : null,
      },
      attendant: null,
    };
  }

  if (role === "attendant") {
    if (!hasAttendant || !data.attendant || typeof data.attendant !== "object") {
      throw new ValidationError("attendant is required when role is attendant.");
    }
    if (hasDriver || hasOwner) {
      throw new ValidationError("Only attendant is allowed when role is attendant.");
    }
    const ownerId = data.attendant.ownerId;
    const lotId = data.attendant.lotId;
    if (!hasValue(ownerId) || !hasValue(lotId)) {
      throw new ValidationError(
        "attendant.ownerId and attendant.lotId are required when role is attendant."
      );
    }
    return {
      driver: null,
      owner: null,
      attendant: {
        ownerId,
        lotId,
        faydaId: hasValue(data.attendant.faydaId)
          ? String(data.attendant.faydaId).trim()
          : null,
        phone: hasValue(data.attendant.phone)
          ? String(data.attendant.phone).trim()
          : null,
        address: hasValue(data.attendant.address)
          ? String(data.attendant.address).trim()
          : null,
        shiftStart: hasValue(data.attendant.shiftStart)
          ? String(data.attendant.shiftStart).trim()
          : null,
        shiftEnd: hasValue(data.attendant.shiftEnd)
          ? String(data.attendant.shiftEnd).trim()
          : null,
      },
    };
  }

  // admin
  if (hasDriver || hasOwner || hasAttendant) {
    throw new ValidationError("Role admin does not accept role-specific profiles.");
  }
  return {
    driver: null,
    owner: null,
    attendant: null,
  };
};

const validateRegisterPayload = (data) => {
  const normalized = normalizeRoleInput(data || {});
  const { email, password, name, role } = normalized;
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
    avatarUrl: hasValue(normalized.avatarUrl)
      ? String(normalized.avatarUrl).trim()
      : null,
    ...sanitizeRoleProfiles(role, normalized),
  };
};

class AuthService {
  async registerUser(data) {
    const {
      email,
      password,
      name,
      role,
      avatarUrl,
      driver,
      owner,
      attendant,
    } = validateRegisterPayload(data);
    if (role === "admin") {
      throw new ForbiddenError("Self-registration for admin role is not allowed.");
    }

    const passwordHash = await hashPassword(password);
    const requiresDriverVerification = role === "driver";
    try {
      const user = await User.create({
        name,
        email,
        role,
        avatarUrl,
        passwordHash,
        status: "active",
        emailVerified: requiresDriverVerification ? false : true,
        emailVerifiedAt: requiresDriverVerification ? null : new Date(),
        driver,
        owner,
        attendant,
      });

      if (requiresDriverVerification) {
        await emailVerificationService.createAndSendSignupOtp(user);
        return {
          requiresVerification: true,
          email: user.email,
        };
      }

      return { user: toSafeUser(user) };
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
    if (user.role === "driver" && user.emailVerified === false) {
      throw new UnauthorizedError("Please verify your email before logging in.");
    }
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError("Invalid email or password.");
    }
    const safeUser = toSafeUser(user);
    const token = this.generateToken(user);
    return {
      token,
      user: safeUser,
      requiresPasswordChange: user.mustChangePassword === true,
    };
  }

  async completeInitialPassword(userId, currentPassword, newPassword) {
    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      throw new ValidationError(strengthError);
    }
    if (!currentPassword || !newPassword) {
      throw new ValidationError("currentPassword and newPassword are required.");
    }
    if (currentPassword === newPassword) {
      throw new ValidationError("New password must be different from your temporary password.");
    }

    const user = await User.findById(userId).select("+passwordHash");
    if (!user || user.status !== "active") {
      throw new UnauthorizedError("Invalid session.");
    }
    if (user.mustChangePassword !== true) {
      throw new ValidationError("Password change is not required for this account.");
    }

    const ok = await comparePassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError("Current password is incorrect.");
    }

    user.passwordHash = await hashPassword(newPassword);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    const safeUser = toSafeUser(user);
    return {
      token: this.generateToken(user),
      user: safeUser,
      requiresPasswordChange: false,
    };
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
