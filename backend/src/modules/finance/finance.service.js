const { ParkingLot } = require("../parking/models/parking-lot.model");
const { ParkingSession } = require("../sessions/models/parking-session.model");
const { Transaction } = require("../operations/models/transaction.model");
const { User } = require("../users/models/user.model");

const pad2 = (n) => String(n).padStart(2, "0");

const formatDateTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.valueOf())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
};

const formatDuration = (entryDate, exitDate) => {
  if (!entryDate) return null;
  const start = new Date(entryDate);
  const end = new Date(exitDate ?? new Date());
  const startMs = start.valueOf();
  const endMs = end.valueOf();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;

  const totalMinutes = Math.floor(Math.max(0, endMs - startMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getDateRangeBounds = (dateRange) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  // Normalize to date-only where appropriate, and use exclusive end.
  if (!dateRange || dateRange === "This Month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return { start, end };
  }

  if (dateRange === "Today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return { start, end };
  }

  if (dateRange === "This Week") {
    // Week starts on Monday.
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7; // Monday => 0
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    end.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return { start, end };
  }

  if (dateRange === "Last Month") {
    start.setMonth(now.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(now.getMonth(), 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (dateRange === "Year to Date") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return { start, end };
  }

  // Fallback: this month.
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return { start, end };
};

const getScopedLotIds = async ({ ownerId, filters }) => {
  const region = filters?.region;
  const city = filters?.city;
  const branch = filters?.branch;

  const lotQuery = { ownerId };
  if (region && region !== "All Regions") lotQuery.region = region;
  if (city && city !== "All Cities") lotQuery.city = city;
  if (branch && branch !== "All Branches") lotQuery.name = branch;

  const lots = await ParkingLot.find(lotQuery).select("_id").lean();
  return lots.map((l) => l._id);
};

const buildDailyBuckets = (start, end) => {
  const buckets = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor < end) {
    const dateKey = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`;
    buckets.push({ key: dateKey, date: new Date(cursor) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
};

class FinanceService {
  async getOwnerTransactions({ ownerId, filters }) {
    const lotIds = await getScopedLotIds({ ownerId, filters });
    if (!lotIds.length) return [];

    const { start, end } = getDateRangeBounds(filters?.dateRange);

    // Fetch transactions and join with session->driver->lot for plate/branch/duration.
    const rows = await Transaction.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
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
        $lookup: {
          from: User.collection.name,
          localField: "session.driverId",
          foreignField: "_id",
          as: "driver",
        },
      },
      { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: ParkingLot.collection.name,
          localField: "session.lotId",
          foreignField: "_id",
          as: "lot",
        },
      },
      { $unwind: { path: "$lot", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          amount: 1,
          method: 1,
          status: 1,
          session: 1,
          driver: 1,
          lot: 1,
        },
      },
    ]);

    const now = new Date();

    return rows.map((r) => {
      const txId = String(r?._id ?? "");
      const createdAt = formatDateTime(r?.createdAt);
      const session = r?.session || {};
      const driver = r?.driver || {};
      const lot = r?.lot || {};

      const entryAt = session?.securedAt || session?.reservedAt || session?.createdAt || null;
      const exitAt = session?.closedAt || session?.expiredAt || null;

      const duration = formatDuration(entryAt, exitAt ?? now);

      const rawStatus = r?.status;
      const uiStatus = rawStatus === "success" ? "Completed" : rawStatus === "pending" ? "Pending" : String(rawStatus ?? "Pending");

      return {
        id: txId,
        date: createdAt ?? "--",
        plate: driver?.driver?.licensePlate ?? "--",
        branch: lot?.name ?? "--",
        duration: duration ?? "--",
        method: String(r?.method ?? "--"),
        status: uiStatus,
        amount: Number(r?.amount ?? 0),
      };
    });
  }

  async getOwnerRevenueTrend({ ownerId, filters }) {
    const lotIds = await getScopedLotIds({ ownerId, filters });
    if (!lotIds.length) return [];

    const range = String(filters?.range || "daily");
    const { start, end } = getDateRangeBounds(filters?.dateRange);

    // Aggregate completed transactions by day first, then roll up.
    const dailyRows = await Transaction.aggregate([
      { $match: { status: "success", createdAt: { $gte: start, $lt: end } } },
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
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          etb: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dailyMap = new Map();
    for (const row of dailyRows) {
      dailyMap.set(String(row?._id ?? ""), Number(row?.etb ?? 0));
    }

    const dailyBuckets = buildDailyBuckets(start, end);

    // Fill zeros for missing days.
    const filledDaily = dailyBuckets.map((b, i) => ({
      key: b.key,
      date: b.date,
      etb: dailyMap.get(b.key) ?? 0,
    }));

    if (range === "daily") {
      return filledDaily.map((b, idx) => ({ label: `D${idx + 1}`, etb: b.etb }));
    }

    if (range === "weekly") {
      const buckets = [];
      const weekCount = Math.ceil(filledDaily.length / 7);
      for (let w = 0; w < weekCount; w += 1) {
        const slice = filledDaily.slice(w * 7, (w + 1) * 7);
        const sum = slice.reduce((acc, d) => acc + Number(d.etb ?? 0), 0);
        buckets.push({ label: `Wk ${w + 1}`, etb: sum });
      }
      return buckets;
    }

    if (range === "monthly") {
      const buckets = [];
      const map = new Map(); // yyyy-mm => sum
      for (const d of filledDaily) {
        const dt = new Date(d.date);
        const key = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
        map.set(key, (map.get(key) ?? 0) + Number(d.etb ?? 0));
      }

      // Preserve chronological order by iterating from start month to end month.
      const startDt = new Date(start);
      const endDt = new Date(end);
      startDt.setDate(1);
      endDt.setDate(1);

      const cursor = new Date(startDt);
      while (cursor <= endDt) {
        const key = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}`;
        const etb = map.get(key) ?? 0;
        const monthLabel = cursor.toLocaleString("en", { month: "short" });
        buckets.push({ label: monthLabel, etb });
        cursor.setMonth(cursor.getMonth() + 1);
      }

      return buckets;
    }

    // Fallback: daily.
    return filledDaily.map((b, idx) => ({ label: `D${idx + 1}`, etb: b.etb }));
  }
}

module.exports = {
  FinanceService,
};

