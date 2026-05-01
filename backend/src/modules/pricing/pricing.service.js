const mongoose = require("mongoose");
const { ParkingLot } = require("../parking/models/parking-lot.model");
const { LotPricing } = require("./models/lot-pricing.model");
const {
  VEHICLE_GROUPS,
  ALL_VEHICLE_CATEGORIES,
  DEFAULT_HOURLY_RATE_ETB,
  ALLOWED_CATEGORY_SET,
} = require("./pricing.constants");
const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} = require("../../common/errors");

const ratesMapToObject = (mapLike) => {
  const out = {};
  if (!mapLike) return out;
  if (mapLike instanceof Map) {
    mapLike.forEach((v, k) => {
      out[String(k)] = v;
    });
    return out;
  }
  if (typeof mapLike === "object") {
    for (const [k, v] of Object.entries(mapLike)) {
      out[k] = v;
    }
  }
  return out;
};

const buildDefaultRatesObject = () =>
  ALL_VEHICLE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = DEFAULT_HOURLY_RATE_ETB;
    return acc;
  }, {});

class PricingService {
  getVehicleCategories() {
    return { groups: VEHICLE_GROUPS };
  }

  async #assertLotAccess(user, lotId) {
    if (!lotId || !mongoose.Types.ObjectId.isValid(String(lotId))) {
      throw new ValidationError("lotId must be a valid id.");
    }
    const lot = await ParkingLot.findById(lotId).select("ownerId name region city overstayMultiplier").lean();
    if (!lot) throw new NotFoundError("Parking lot not found.");

    if (user.role === "admin") return lot;
    if (user.role !== "owner") {
      throw new ForbiddenError("Only owners and admins can manage pricing.");
    }
    if (String(lot.ownerId) !== String(user.userId)) {
      throw new ForbiddenError("This lot does not belong to your account.");
    }
    return lot;
  }

  async getConfig(user, lotId) {
    const lot = await this.#assertLotAccess(user, lotId);
    const doc = await LotPricing.findOne({ lotId }).lean();
    const stored = doc ? ratesMapToObject(doc.rates) : {};
    const defaults = buildDefaultRatesObject();
    const rates = { ...defaults, ...stored };

    const mult = Number(lot.overstayMultiplier);
    const overstayMultiplier = Number.isFinite(mult) && mult >= 1 ? mult : 1;

    return {
      lotId: String(lot._id),
      name: lot.name,
      region: lot.region,
      city: lot.city,
      overstayMultiplier,
      rates,
    };
  }

  async upsertConfig(user, lotId, body = {}) {
    const lot = await this.#assertLotAccess(user, lotId);

    const rawMult = body.overstayMultiplier !== undefined ? Number(body.overstayMultiplier) : Number(lot.overstayMultiplier);
    if (!Number.isFinite(rawMult) || rawMult < 1) {
      throw new ValidationError("overstayMultiplier must be a number >= 1.");
    }

    if (!body.rates || typeof body.rates !== "object" || Array.isArray(body.rates)) {
      throw new ValidationError("rates must be an object keyed by vehicle category.");
    }

    const nextRates = {};
    for (const [key, val] of Object.entries(body.rates)) {
      if (!ALLOWED_CATEGORY_SET.has(key)) {
        throw new ValidationError(`Unknown vehicle category: ${key}`);
      }
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0) {
        throw new ValidationError(`Invalid rate for "${key}": must be a non-negative number.`);
      }
      nextRates[key] = n;
    }

    for (const cat of ALL_VEHICLE_CATEGORIES) {
      if (nextRates[cat] === undefined) {
        nextRates[cat] = DEFAULT_HOURLY_RATE_ETB;
      }
    }

    await ParkingLot.findByIdAndUpdate(lotId, { overstayMultiplier: rawMult });

    const ratesMap = new Map(Object.entries(nextRates));
    await LotPricing.findOneAndUpdate(
      { lotId },
      {
        $set: {
          rates: ratesMap,
          updatedBy: user.userId,
        },
      },
      { upsert: true, new: true }
    );

    return this.getConfig(user, lotId);
  }
}

module.exports = {
  PricingService,
  buildDefaultRatesObject,
};
