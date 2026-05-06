const { User } = require("../users/models/user.model");
const { ParkingLot } = require("../parking/models/parking-lot.model");
const { WalkupCheckin } = require("./models/walkup-checkin.model");
const { ValidationError, NotFoundError } = require("../../common/errors");

const VEHICLE_RATES = {
  "Public Transport Vehicles | Upto 12 Seats": 30,
  "Public Transport Vehicles | 13-24 Seats": 45,
  "Public Transport Vehicles | 25 Seats and above": 60,
  "Bicycle | Bicycle": 5,
  "Motorcycle | Motorcycle": 10,
  "Dry Freight Vehicles | <35 Quintal": 40,
  "Dry Freight Vehicles | 36-70 Quintal": 70,
  "Dry Freight Vehicles | >71 Quintal": 100,
  "Liquid Cargo Vehicles | Upto 28 Liter": 80,
  "Liquid Cargo Vehicles | Above 28 Liter": 120,
  "Machineries | Upto 5000KG weight": 100,
  "Machineries | 5001-10,000KG weight": 150,
  "Machineries | Above 10,001KG weight": 200,
};

const formatRelativeTime = (date) => {
  const diffMs = Math.max(0, Date.now() - new Date(date).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m ago`;
};

const formatDuration = (durationMinutes) => {
  const total = Math.max(0, Number(durationMinutes) || 0);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${minutes}m`;
};

const parseRegionPrefix = (region = "") => {
  const match = String(region).match(/\(([^)]+)\)/);
  return match ? String(match[1]).trim() : "AA";
};

const buildPlatePrefix = ({ licenceType, region }) => {
  if (licenceType === "Diplomatic") return "";
  if (licenceType === "United Nations") return "UN";
  if (licenceType === "African Union") return "AU";
  if (licenceType === "Government" || licenceType === "Temporary") return "ET";
  return parseRegionPrefix(region);
};

const normalizePlateInput = ({ licenceType, plateInput }) => {
  const raw = String(plateInput || "").toUpperCase().trim();
  if (!raw) {
    throw new ValidationError("plate is required.");
  }

  if (licenceType === "Diplomatic") {
    const compact = raw.replace(/\s+/g, "");
    const isValid = /^(0[1-9]|[1-9][0-9]|1[0-2][0-9]|13[0-2])(CD)?[0-9]{4}$/.test(compact);
    if (!isValid) {
      throw new ValidationError("Invalid diplomatic plate format.");
    }
    return compact;
  }

  const digitsOnly = raw.replace(/[^0-9]/g, "");
  const isValid = /^[0-9]{6,7}$/.test(digitsOnly);
  if (!isValid) {
    throw new ValidationError("Plate must contain 6 to 7 digits.");
  }
  return digitsOnly;
};

class AttendantWalkupService {
  async #resolveAttendantScope(userId) {
    const attendant = await User.findById(userId).select("role attendant.lotId").lean();
    if (!attendant) throw new NotFoundError("User not found.");
    if (attendant.role !== "attendant") {
      throw new ValidationError("Only attendants may access walk-up POS.");
    }
    const lotId = attendant?.attendant?.lotId;
    if (!lotId) throw new ValidationError("Attendant.lotId is required for branch scoping.");

    const lot = await ParkingLot.findById(lotId).select("name").lean();
    if (!lot) throw new NotFoundError("Assigned branch not found.");
    return { lotId, lotName: lot.name };
  }

  async createWalkupCheckin({ userId, payload }) {
    const { lotId, lotName } = await this.#resolveAttendantScope(userId);

    const licenceType = String(payload?.licenceType || "").trim();
    const region = payload?.region ? String(payload.region).trim() : null;
    const countryCode = payload?.countryCode ? String(payload.countryCode).trim() : null;
    const vehicleType = String(payload?.vehicleType || "").trim();
    const plateInputRaw = payload?.plate;

    if (!licenceType) throw new ValidationError("licenceType is required.");
    if (!vehicleType) throw new ValidationError("vehicleType is required.");

    const durationHours = Math.max(0, Number(payload?.durationHours ?? 0));
    const durationMinutesPart = Math.max(0, Number(payload?.durationMinutes ?? 0));
    const totalDurationMinutes = Math.floor(durationHours * 60 + durationMinutesPart);
    if (!Number.isFinite(totalDurationMinutes) || totalDurationMinutes <= 0) {
      throw new ValidationError("Duration must be greater than zero.");
    }

    const hourlyRate = Number(VEHICLE_RATES[vehicleType]);
    if (!Number.isFinite(hourlyRate)) {
      throw new ValidationError("Unsupported vehicleType for walk-up pricing.");
    }

    const normalizedPlateInput = normalizePlateInput({
      licenceType,
      plateInput: plateInputRaw,
    });
    const platePrefix = buildPlatePrefix({ licenceType, region });
    const plateNumber = platePrefix ? `${platePrefix} ${normalizedPlateInput}` : normalizedPlateInput;

    const amount = Number((hourlyRate * (totalDurationMinutes / 60)).toFixed(2));
    const now = new Date();
    const nonce = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    const transactionCode = `TRX-${now.getTime()}-${nonce}`;
    const receiptCode = `WUP-${now.getTime()}-${nonce}`;

    const checkin = await WalkupCheckin.create({
      transactionCode,
      receiptCode,
      lotId,
      attendantId: userId,
      licenceType,
      region,
      countryCode,
      platePrefix: platePrefix || null,
      plateInput: normalizedPlateInput,
      plateNumber,
      vehicleType,
      hourlyRate,
      durationMinutes: totalDurationMinutes,
      amount,
      paymentMethod: "cash",
      status: "active",
      checkedInAt: now,
      metadata: {
        source: "walkup_pos",
      },
    });

    return {
      id: String(checkin._id),
      transactionCode: checkin.transactionCode,
      receiptCode: checkin.receiptCode,
      branchName: lotName,
      plate: checkin.plateNumber,
      category: checkin.vehicleType,
      amount: checkin.amount,
      time: new Date(checkin.checkedInAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      duration: formatDuration(checkin.durationMinutes),
      status: "Active",
    };
  }

  async listRecentCheckins({ userId, limit = 25 }) {
    const { lotId } = await this.#resolveAttendantScope(userId);
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);

    const rows = await WalkupCheckin.find({ lotId })
      .sort({ checkedInAt: -1 })
      .limit(safeLimit)
      .select("transactionCode plateNumber vehicleType amount status durationMinutes checkedInAt")
      .lean();

    return rows.map((row) => ({
      id: row.transactionCode,
      plate: row.plateNumber,
      category: row.vehicleType,
      amount: Number(row.amount ?? 0),
      time: formatRelativeTime(row.checkedInAt),
      status: row.status === "active" ? "Active" : "Completed",
      duration: formatDuration(row.durationMinutes),
    }));
  }

  async getReceipt({ userId, checkinId }) {
    const { lotId, lotName } = await this.#resolveAttendantScope(userId);
    const row = await WalkupCheckin.findOne({ _id: checkinId, lotId }).lean();
    if (!row) throw new NotFoundError("Walk-up receipt not found.");

    return {
      id: String(row._id),
      transactionCode: row.transactionCode,
      receiptCode: row.receiptCode,
      branchName: lotName,
      plate: row.plateNumber,
      category: row.vehicleType,
      amount: Number(row.amount ?? 0),
      time: new Date(row.checkedInAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      duration: formatDuration(row.durationMinutes),
      status: row.status === "active" ? "Active" : "Completed",
    };
  }
}

module.exports = {
  AttendantWalkupService,
};

