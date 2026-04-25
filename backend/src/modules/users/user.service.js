const { User, USER_ROLES } = require("./models/user.model");
const {
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} = require("../../common/errors");
const { hashPassword, toSafeUser } = require("../auth/auth.utils");
const { ParkingLot } = require("../parking/models/parking-lot.model");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim().length > 0;

const normalizeRoleInput = (payload = {}) => {
  const normalized = { ...payload };
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

const sanitizeRoleProfiles = (role, payload = {}) => {
  const hasDriver = payload.driver !== undefined;
  const hasOwner = payload.owner !== undefined;
  const hasAttendant = payload.attendant !== undefined;

  if (role === "driver") {
    if (
      !hasDriver ||
      !payload.driver ||
      typeof payload.driver !== "object"
    ) {
      throw new ValidationError("driver is required when role is driver.");
    }
    if (!hasValue(payload.driver.licensePlate)) {
      throw new ValidationError(
        "driver.licensePlate is required when role is driver."
      );
    }
    if (hasOwner || hasAttendant) {
      throw new ValidationError("Only driver is allowed when role is driver.");
    }
    return {
      driver: {
        phone: hasValue(payload.driver.phone)
          ? String(payload.driver.phone).trim()
          : null,
        licensePlate: String(payload.driver.licensePlate).trim(),
        vehicleType: hasValue(payload.driver.vehicleType)
          ? String(payload.driver.vehicleType).trim()
          : null,
        region: hasValue(payload.driver.region)
          ? String(payload.driver.region).trim()
          : null,
        country: hasValue(payload.driver.country)
          ? String(payload.driver.country).trim()
          : null,
        paymentMethod: hasValue(payload.driver.paymentMethod)
          ? String(payload.driver.paymentMethod).trim()
          : null,
        paymentAccount: hasValue(payload.driver.paymentAccount)
          ? String(payload.driver.paymentAccount).trim()
          : null,
      },
      owner: null,
      attendant: null,
    };
  }

  if (role === "owner") {
    if (
      !hasOwner ||
      !payload.owner ||
      typeof payload.owner !== "object"
    ) {
      throw new ValidationError("owner is required when role is owner.");
    }
    if (hasDriver || hasAttendant) {
      throw new ValidationError("Only owner is allowed when role is owner.");
    }
    return {
      driver: null,
      owner: {
        phone: hasValue(payload.owner.phone)
          ? String(payload.owner.phone).trim()
          : null,
        companyName: hasValue(payload.owner.companyName)
          ? String(payload.owner.companyName).trim()
          : null,
        tinNumber: hasValue(payload.owner.tinNumber)
          ? String(payload.owner.tinNumber).trim()
          : null,
      },
      attendant: null,
    };
  }

  if (role === "attendant") {
    if (
      !hasAttendant ||
      !payload.attendant ||
      typeof payload.attendant !== "object"
    ) {
      throw new ValidationError("attendant is required when role is attendant.");
    }
    if (hasDriver || hasOwner) {
      throw new ValidationError("Only attendant is allowed when role is attendant.");
    }
    const ownerId = payload.attendant.ownerId;
    const lotId = payload.attendant.lotId;
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
        faydaId: hasValue(payload.attendant.faydaId)
          ? String(payload.attendant.faydaId).trim()
          : null,
        phone: hasValue(payload.attendant.phone)
          ? String(payload.attendant.phone).trim()
          : null,
        address: hasValue(payload.attendant.address)
          ? String(payload.attendant.address).trim()
          : null,
        shiftStart: hasValue(payload.attendant.shiftStart)
          ? String(payload.attendant.shiftStart).trim()
          : null,
        shiftEnd: hasValue(payload.attendant.shiftEnd)
          ? String(payload.attendant.shiftEnd).trim()
          : null,
      },
    };
  }

  if (hasDriver || hasOwner || hasAttendant) {
    throw new ValidationError("Role admin does not accept role-specific profiles.");
  }
  return {
    driver: null,
    owner: null,
    attendant: null,
  };
};

class UserService {
  async createUser(payload) {
    const normalized = normalizeRoleInput(payload || {});
    const { name, email, role, password } = normalized;

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
    const { driver, owner, attendant } = sanitizeRoleProfiles(role, normalized);

    try {
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        role,
        avatarUrl: hasValue(normalized.avatarUrl)
          ? String(normalized.avatarUrl).trim()
          : null,
        passwordHash,
        status: "active",
        driver,
        owner,
        attendant,
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

  async createOwnerByAdmin(adminUser, payload) {
    if (!adminUser || adminUser.role !== "admin") {
      throw new ForbiddenError("Only admin can create owners.");
    }
    if (payload?.role && payload.role !== "owner") {
      throw new ValidationError("role mismatch: this endpoint only creates owner.");
    }
    return this.createUser({
      ...payload,
      role: "owner",
    });
  }

  async createAttendantByOwner(ownerUser, payload) {
    if (!ownerUser || ownerUser.role !== "owner") {
      throw new ForbiddenError("Only owner can create attendants.");
    }
    if (payload?.role && payload.role !== "attendant") {
      throw new ValidationError("role mismatch: this endpoint only creates attendant.");
    }

    const normalized = normalizeRoleInput(payload || {});
    if (!normalized.attendant || typeof normalized.attendant !== "object") {
      throw new ValidationError("attendant is required.");
    }
    if (!hasValue(normalized.attendant.lotId)) {
      throw new ValidationError("attendant.lotId is required.");
    }

    const ownerUserId = ownerUser.userId || ownerUser.id || ownerUser._id;
    const lot = await ParkingLot.findById(normalized.attendant.lotId).select("ownerId");
    if (!lot) {
      throw new NotFoundError("Lot not found.");
    }
    if (String(lot.ownerId) !== String(ownerUserId)) {
      throw new ForbiddenError("attendant.lotId must belong to the authenticated owner.");
    }

    return this.createUser({
      ...normalized,
      role: "attendant",
      attendant: {
        ...normalized.attendant,
        ownerId: String(ownerUserId),
      },
    });
  }
}

module.exports = {
  UserService,
};
