const { User, USER_ROLES } = require("./models/user.model");
const {
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} = require("../../common/errors");
const { hashPassword, toSafeUser } = require("../auth/auth.utils");
const { ParkingLot } = require("../parking/models/parking-lot.model");

const DRIVER_PAYMENT_METHODS = new Set([
  "Telebirr",
  "CBE",
  "COOP",
  "Bank of Abyssinia",
]);

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
    const pm = hasValue(payload.driver.paymentMethod)
      ? String(payload.driver.paymentMethod).trim()
      : "Telebirr";
    if (!DRIVER_PAYMENT_METHODS.has(pm)) {
      throw new ValidationError(
        `driver.paymentMethod must be one of: ${Array.from(DRIVER_PAYMENT_METHODS).join(", ")}.`
      );
    }
    const paymentAccountRaw = hasValue(payload.driver.paymentAccount)
      ? String(payload.driver.paymentAccount).trim()
      : null;
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
        paymentMethod: pm,
        paymentAccount: pm === "Telebirr" ? null : paymentAccountRaw,
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

  async listAttendantsByOwner(ownerUser) {
    if (!ownerUser || ownerUser.role !== "owner") {
      throw new ForbiddenError("Only owner can view attendants.");
    }

    const ownerUserId = ownerUser.userId || ownerUser.id || ownerUser._id;
    const attendants = await User.find({
      role: "attendant",
      "attendant.ownerId": ownerUserId,
    }).sort({ createdAt: -1 });

    return attendants.map((attendant) => toSafeUser(attendant));
  }

  async updateAttendantByOwner(ownerUser, attendantId, payload = {}) {
    if (!ownerUser || ownerUser.role !== "owner") {
      throw new ForbiddenError("Only owner can update attendants.");
    }
    if (!attendantId) {
      throw new ValidationError("attendantId is required.");
    }

    const ownerUserId = ownerUser.userId || ownerUser.id || ownerUser._id;

    const existing = await User.findById(attendantId).select(
      "name email avatarUrl role status attendant"
    );
    if (!existing || existing.role !== "attendant" || !existing.attendant) {
      throw new NotFoundError("Attendant not found.");
    }

    if (String(existing.attendant.ownerId) !== String(ownerUserId)) {
      throw new ForbiddenError("You can only update your own attendants.");
    }

    const next = {};

    if (payload?.name !== undefined) {
      if (typeof payload.name !== "string") {
        throw new ValidationError("name must be a string.");
      }
      next.name = payload.name.trim();
    }

    if (payload?.email !== undefined) {
      if (typeof payload.email !== "string") {
        throw new ValidationError("email must be a string.");
      }
      const normalizedEmail = String(payload.email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new ValidationError("email must be a valid email address.");
      }
      next.email = normalizedEmail;
    }

    if (payload?.avatarUrl !== undefined) {
      // Allow clearing avatar by passing null
      if (payload.avatarUrl !== null && typeof payload.avatarUrl !== "string") {
        throw new ValidationError("avatarUrl must be a string or null.");
      }
      next.avatarUrl = payload.avatarUrl ? String(payload.avatarUrl).trim() : null;
    }

    if (payload?.attendant && typeof payload.attendant === "object") {
      const attendantPatch = {};

      const attendantInput = payload.attendant;

      if (attendantInput?.lotId !== undefined) {
        if (!hasValue(attendantInput.lotId)) {
          throw new ValidationError("attendant.lotId is required.");
        }

        const lot = await ParkingLot.findById(attendantInput.lotId).select(
          "ownerId"
        );
        if (!lot) {
          throw new NotFoundError("Lot not found.");
        }
        if (String(lot.ownerId) !== String(ownerUserId)) {
          throw new ForbiddenError(
            "attendant.lotId must belong to the authenticated owner."
          );
        }

        attendantPatch.lotId = attendantInput.lotId;
        attendantPatch.ownerId = String(ownerUserId); // keep consistent
      }

      if (attendantInput?.phone !== undefined) {
        attendantPatch.phone = hasValue(attendantInput.phone)
          ? String(attendantInput.phone).trim()
          : null;
      }

      if (attendantInput?.faydaId !== undefined) {
        attendantPatch.faydaId = hasValue(attendantInput.faydaId)
          ? String(attendantInput.faydaId).trim()
          : null;
      }

      if (attendantInput?.shiftStart !== undefined) {
        attendantPatch.shiftStart = hasValue(attendantInput.shiftStart)
          ? String(attendantInput.shiftStart).trim()
          : null;
      }

      if (attendantInput?.shiftEnd !== undefined) {
        attendantPatch.shiftEnd = hasValue(attendantInput.shiftEnd)
          ? String(attendantInput.shiftEnd).trim()
          : null;
      }

      if (attendantInput?.address !== undefined) {
        attendantPatch.address = hasValue(attendantInput.address)
          ? String(attendantInput.address).trim()
          : null;
      }

      if (Object.keys(attendantPatch).length > 0) {
        existing.attendant = {
          ...existing.attendant,
          ...attendantPatch,
        };
      }
    }

    if (Object.keys(next).length > 0) {
      existing.set(next);
    }

    await existing.save();
    return toSafeUser(existing);
  }

  async deleteAttendantByOwner(ownerUser, attendantId) {
    if (!ownerUser || ownerUser.role !== "owner") {
      throw new ForbiddenError("Only owner can delete attendants.");
    }
    if (!attendantId) {
      throw new ValidationError("attendantId is required.");
    }

    const ownerUserId = ownerUser.userId || ownerUser.id || ownerUser._id;

    const deleted = await User.findOneAndDelete({
      _id: attendantId,
      role: "attendant",
      "attendant.ownerId": ownerUserId,
    });

    if (!deleted) {
      throw new NotFoundError("Attendant not found.");
    }

    return true;
  }

  async updateDriverSelf(driverUser, payload = {}) {
    if (!driverUser || driverUser.role !== "driver") {
      throw new ForbiddenError("Only drivers can update driver payment settings.");
    }

    const driverUserId = driverUser.userId || driverUser.id || driverUser._id;
    const existing = await User.findById(driverUserId).select(
      "name email avatarUrl profileImageUrl profileImagePublicId role status driver"
    );

    if (!existing || existing.role !== "driver" || !existing.driver) {
      throw new NotFoundError("Driver not found.");
    }

    const driverInput = payload.driver;
    if (!driverInput || typeof driverInput !== "object") {
      throw new ValidationError("driver is required.");
    }

    if (driverInput.paymentMethod === undefined) {
      throw new ValidationError("driver.paymentMethod is required.");
    }

    const pm = String(driverInput.paymentMethod || "").trim();
    if (!DRIVER_PAYMENT_METHODS.has(pm)) {
      throw new ValidationError(
        `driver.paymentMethod must be one of: ${Array.from(DRIVER_PAYMENT_METHODS).join(", ")}.`
      );
    }

    const nextDriver = {
      ...(existing.driver.toObject ? existing.driver.toObject() : { ...existing.driver }),
    };
    nextDriver.paymentMethod = pm;

    if (pm === "Telebirr") {
      nextDriver.paymentAccount = null;
    } else {
      const acct =
        driverInput.paymentAccount !== undefined && driverInput.paymentAccount !== null
          ? String(driverInput.paymentAccount).trim()
          : "";
      if (!hasValue(acct)) {
        throw new ValidationError(
          "driver.paymentAccount is required when payment method is not Telebirr."
        );
      }
      nextDriver.paymentAccount = acct;
    }

    existing.driver = nextDriver;
    await existing.save();
    return toSafeUser(existing);
  }

  async updateOwnerSelf(ownerUser, payload = {}) {
    if (!ownerUser || ownerUser.role !== "owner") {
      throw new ForbiddenError("Only owner can update owner profile.");
    }

    const ownerUserId = ownerUser.userId || ownerUser.id || ownerUser._id;
    const existing = await User.findById(ownerUserId).select(
      "name email avatarUrl role status owner"
    );

    if (!existing || existing.role !== "owner") {
      throw new NotFoundError("Owner not found.");
    }

    const next = {};

    if (payload?.name !== undefined) {
      if (typeof payload.name !== "string") {
        throw new ValidationError("name must be a string.");
      }
      next.name = payload.name.trim();
    }

    if (payload?.email !== undefined) {
      if (typeof payload.email !== "string") {
        throw new ValidationError("email must be a string.");
      }
      const normalizedEmail = String(payload.email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new ValidationError("email must be a valid email address.");
      }
      next.email = normalizedEmail;
    }

    if (payload?.avatarUrl !== undefined) {
      if (payload.avatarUrl !== null && typeof payload.avatarUrl !== "string") {
        throw new ValidationError("avatarUrl must be a string or null.");
      }
      next.avatarUrl = payload.avatarUrl ? String(payload.avatarUrl).trim() : null;
    }

    if (payload?.owner && typeof payload.owner === "object") {
      const ownerPatch = {};
      const ownerInput = payload.owner;

      if (ownerInput?.phone !== undefined) {
        ownerPatch.phone = hasValue(ownerInput.phone)
          ? String(ownerInput.phone).trim()
          : null;
      }

      if (ownerInput?.companyName !== undefined) {
        ownerPatch.companyName = hasValue(ownerInput.companyName)
          ? String(ownerInput.companyName).trim()
          : null;
      }

      if (ownerInput?.tinNumber !== undefined) {
        ownerPatch.tinNumber = hasValue(ownerInput.tinNumber)
          ? String(ownerInput.tinNumber).trim()
          : null;
      }

      if (Object.keys(ownerPatch).length > 0) {
        existing.owner = {
          ...(existing.owner || {}),
          ...ownerPatch,
        };
      }
    }

    if (Object.keys(next).length > 0) {
      existing.set(next);
    }

    try {
      await existing.save();
    } catch (error) {
      if (error && error.code === 11000) {
        throw new ConflictError("A user with this email already exists.");
      }
      throw error;
    }

    return toSafeUser(existing);
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
