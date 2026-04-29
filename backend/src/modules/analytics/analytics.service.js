const { ParkingLot } = require("../parking/models/parking-lot.model");
const { ParkingSpot } = require("../parking/models/parking-spot.model");
const { ParkingSession } = require("../sessions/models/parking-session.model");
const { Transaction } = require("../operations/models/transaction.model");

const formatTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.valueOf())) return null;

  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const mm = String(d.getMinutes()).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");
  return `${hh}:${mm} ${ampm}`;
};

const formatDuration = (startDate, endDate) => {
  if (!startDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate ?? new Date());

  const startMs = start.valueOf();
  const endMs = end.valueOf();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;

  const totalMinutes = Math.floor(Math.max(0, endMs - startMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return { start, end };
};

class AnalyticsService {
  async #getScopedLotIds({ ownerId, scope }) {
    const lotQuery = { ownerId };

    const region = scope?.region;
    const city = scope?.city;
    const branch = scope?.branch;

    if (region && region !== "All Regions") lotQuery.region = region;
    if (city && city !== "All Cities") lotQuery.city = city;
    if (branch && branch !== "All Branches") lotQuery.name = branch;

    const lots = await ParkingLot.find(lotQuery).select("_id").lean();
    return lots.map((l) => l._id);
  }

  async getOwnerDashboard({ ownerId, scope }) {
    const lotIds = await this.#getScopedLotIds({ ownerId, scope });
    if (!lotIds.length) {
      return {
        activeSessions: 0,
        availableSpots: 0,
        occupiedSpots: 0,
        revenueToday: 0,
      };
    }

    const { start, end } = getTodayRange();

    const [activeSessions, availableSpots, occupiedSpots, revenueRows] = await Promise.all([
      ParkingSession.countDocuments({
        lotId: { $in: lotIds },
        state: { $in: ["reserved", "secured"] },
      }),
      ParkingSpot.countDocuments({ lotId: { $in: lotIds }, status: "free" }),
      ParkingSpot.countDocuments({
        lotId: { $in: lotIds },
        status: { $in: ["occupied", "reserved", "blocked"] },
      }),
      Transaction.aggregate([
        {
          $match: {
            status: "success",
            completedAt: { $gte: start, $lt: end },
          },
        },
        {
          $lookup: {
            from: ParkingSession.collection.name,
            localField: "sessionId",
            foreignField: "_id",
            as: "session",
          },
        },
        { $unwind: "$session" },
        { $match: { "session.lotId": { $in: lotIds } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const revenueToday = Number(revenueRows?.[0]?.total ?? 0);

    return {
      activeSessions,
      availableSpots,
      occupiedSpots,
      revenueToday,
    };
  }

  async getOwnerOccupancy({ ownerId, scope }) {
    const lotIds = await this.#getScopedLotIds({ ownerId, scope });
    if (!lotIds.length) {
      return [
        { name: "Occupied", value: 0 },
        { name: "Available", value: 0 },
      ];
    }

    const [availableSpots, occupiedSpots] = await Promise.all([
      ParkingSpot.countDocuments({ lotId: { $in: lotIds }, status: "free" }),
      ParkingSpot.countDocuments({
        lotId: { $in: lotIds },
        status: { $in: ["occupied", "reserved", "blocked"] },
      }),
    ]);

    return [
      { name: "Occupied", value: occupiedSpots },
      { name: "Available", value: availableSpots },
    ];
  }

  async getOwnerRevenueByHour({ ownerId, scope, range }) {
    const lotIds = await this.#getScopedLotIds({ ownerId, scope });
    if (!lotIds.length) return [];

    const normalizedRange = String(range || "today");
    if (normalizedRange !== "today") {
      // Only `today` is required by the current UI contract.
      return [];
    }

    const { start, end } = getTodayRange();

    const rows = await Transaction.aggregate([
      {
        $match: {
          status: "success",
          completedAt: { $gte: start, $lt: end },
        },
      },
      {
        $lookup: {
          from: ParkingSession.collection.name,
          localField: "sessionId",
          foreignField: "_id",
          as: "session",
        },
      },
      { $unwind: "$session" },
      { $match: { "session.lotId": { $in: lotIds } } },
      {
        $group: {
          _id: { hour: { $hour: "$completedAt" } },
          etb: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.hour": 1 } },
    ]);

    return rows.map((r) => {
      const hour = Number(r?._id?.hour ?? 0);
      return {
        hour: `${String(hour).padStart(2, "0")}:00`,
        etb: Number(r?.etb ?? 0),
      };
    });
  }

  async getOwnerRecentActivity({ ownerId, scope }) {
    const lotIds = await this.#getScopedLotIds({ ownerId, scope });
    if (!lotIds.length) return [];

    // Keep the UI's "Recent Activity" table compact.
    const limit = 4;

    const sessions = await ParkingSession.find({ lotId: { $in: lotIds } })
      .sort({ reservedAt: -1 })
      .limit(limit)
      .populate({
        path: "driverId",
        select: "driver.licensePlate driver.vehicleType driver.paymentMethod",
      })
      .populate({
        path: "lotId",
        select: "name",
      })
      .lean();

    if (!sessions.length) return [];

    const sessionIds = sessions.map((s) => s._id);

    const transactions = await Transaction.find({
      sessionId: { $in: sessionIds },
      status: "success",
    })
      .sort({ completedAt: -1 })
      .lean();

    const txBySessionId = new Map();
    for (const tx of transactions) {
      const key = String(tx.sessionId);
      if (!txBySessionId.has(key)) txBySessionId.set(key, tx);
    }

    const now = new Date();

    return sessions.map((s) => {
      const entryAt = s.securedAt || s.reservedAt || s.createdAt || null;
      const exitAt = s.closedAt || s.expiredAt || null;

      const duration = formatDuration(entryAt, exitAt ?? now) ?? "--";

      const driver = s?.driverId?.driver || {};
      const paymentTx = txBySessionId.get(String(s._id));

      return {
        id: String(s._id),
        plateNumber: driver?.licensePlate ?? null,
        vehicleCategory: driver?.vehicleType ?? null,
        branchName: s?.lotId?.name ?? null,
        entryTime: formatTime(entryAt),
        exitTime: exitAt ? formatTime(exitAt) : null,
        duration,
        paymentMethod: paymentTx?.method ?? driver?.paymentMethod ?? null,
      };
    });
  }
}

module.exports = {
  AnalyticsService,
};

