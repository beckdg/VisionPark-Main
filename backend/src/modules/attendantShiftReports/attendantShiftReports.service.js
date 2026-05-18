const mongoose = require("mongoose");
const { User } = require("../users/models/user.model");
const { ParkingLot } = require("../parking/models/parking-lot.model");
const { WalkupCheckin } = require("../attendantWalkup/models/walkup-checkin.model");
const { Transaction } = require("../operations/models/transaction.model");
const { ParkingSession } = require("../sessions/models/parking-session.model");
const { AttendantShift } = require("./models/attendant-shift.model");
const { ShiftReport } = require("./models/shift-report.model");
const {
  ValidationError,
  NotFoundError,
  ConflictError,
} = require("../../common/errors");

const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDuration = (startDate, endDate = new Date()) => {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const totalMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

const getShiftDayBounds = (shiftStartedAt) => {
  const anchor = new Date(shiftStartedAt);
  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(anchor);
  dayEnd.setHours(23, 59, 59, 999);
  return { dayStart, dayEnd };
};

const getShiftWindow = (shiftStartedAt, currentTime = new Date()) => {
  const now = new Date(currentTime);
  const { dayStart, dayEnd } = getShiftDayBounds(shiftStartedAt);
  const windowStart = new Date(Math.max(new Date(shiftStartedAt).getTime(), dayStart.getTime()));
  const windowEnd = new Date(Math.min(now.getTime(), dayEnd.getTime()));
  return { windowStart, windowEnd, now };
};

const isCashPaymentMethod = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "cash" || normalized === "";
};

const isCashTransaction = (txn) => {
  const method = String(txn?.method || "").trim().toLowerCase();
  if (method === "chapa") return false;
  const provider = String(txn?.provider || "").trim().toLowerCase();
  if (["telebirr", "visa", "cbe", "card"].includes(provider)) return false;
  if (method === "manual" && !provider) return true;
  return isCashPaymentMethod(txn?.metadata?.paymentMethod);
};

const mapTransactionMethodLabel = (txn) => {
  const method = String(txn?.method || "").trim().toLowerCase();
  if (method === "chapa") return "Chapa";
  const provider = String(txn?.provider || "").trim().toLowerCase();
  if (provider === "telebirr") return "Telebirr";
  if (provider === "visa") return "Card";
  if (provider === "cbe") return "CBE";
  if (isCashTransaction(txn)) return "Cash";
  return method ? method.charAt(0).toUpperCase() + method.slice(1) : "Digital";
};

const mapWalkupPaymentLabel = (paymentMethod) => {
  const normalized = String(paymentMethod || "cash").trim().toLowerCase();
  if (!normalized || normalized === "cash") return "Cash";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

class AttendantShiftReportsService {
  async #resolveAttendantScope(userId) {
    const attendant = await User.findById(userId)
      .select("name role attendant.lotId")
      .lean();
    if (!attendant) throw new NotFoundError("User not found.");
    if (attendant.role !== "attendant") {
      throw new ValidationError("Only attendants may access shift reports.");
    }

    const branchId = attendant?.attendant?.lotId;
    if (!branchId) {
      throw new ValidationError("Attendant branch assignment is required.");
    }

    const lot = await ParkingLot.findById(branchId).select("name").lean();
    if (!lot) throw new NotFoundError("Assigned branch not found.");

    return {
      attendantId: userId,
      attendantName: attendant.name,
      branchId,
      branchName: lot.name,
    };
  }

  async #findActiveShift(attendantId) {
    return AttendantShift.findOne({ attendantId, status: "active" }).lean();
  }

  async #aggregateShiftData({ branchId, shiftStartedAt, currentTime = new Date() }) {
    const { windowStart, windowEnd, now } = getShiftWindow(shiftStartedAt, currentTime);

    const walkUpQuery = {
      lotId: branchId,
      checkedInAt: { $gte: windowStart, $lte: windowEnd },
    };

    const sessionRows = await ParkingSession.find({ lotId: branchId })
      .select("_id")
      .lean();
    const sessionIds = sessionRows.map((row) => row._id);

    const transactionQuery = {
      sessionId: { $in: sessionIds },
      status: "success",
      completedAt: { $gte: windowStart, $lte: windowEnd },
    };

    const [walkUps, transactions] = await Promise.all([
      WalkupCheckin.find(walkUpQuery)
        .sort({ checkedInAt: -1 })
        .select(
          "plateNumber vehicleType amount paymentMethod status checkedInAt transactionCode"
        )
        .lean(),
      sessionIds.length
        ? Transaction.find(transactionQuery)
            .sort({ completedAt: -1 })
            .select("amount method provider status completedAt metadata")
            .lean()
        : Promise.resolve([]),
    ]);

    let cashPayments = 0;
    let digitalPayments = 0;
    let totalRevenue = 0;

    for (const walkUp of walkUps) {
      const amount = roundMoney(walkUp.amount);
      totalRevenue += amount;
      if (isCashPaymentMethod(walkUp.paymentMethod)) {
        cashPayments += amount;
      } else {
        digitalPayments += amount;
      }
    }

    for (const txn of transactions) {
      const amount = roundMoney(txn.amount);
      totalRevenue += amount;
      if (isCashTransaction(txn)) {
        cashPayments += amount;
      } else {
        digitalPayments += amount;
      }
    }

    return {
      windowStart,
      windowEnd,
      now,
      walkUps,
      transactions,
      totals: {
        totalWalkUps: walkUps.length,
        totalTransactions: transactions.length,
        totalRevenue: roundMoney(totalRevenue),
        cashPayments: roundMoney(cashPayments),
        digitalPayments: roundMoney(digitalPayments),
        expectedCashInHand: roundMoney(cashPayments),
      },
    };
  }

  #mapZReportPayload({ shift, scope, aggregate }) {
    return {
      shiftId: String(shift._id),
      attendant: {
        id: String(scope.attendantId),
        name: scope.attendantName,
        branchName: scope.branchName,
      },
      shift: {
        startedAt: shift.startedAt,
        currentTime: aggregate.now,
        duration: formatDuration(shift.startedAt, aggregate.now),
      },
      totals: aggregate.totals,
      walkUps: aggregate.walkUps.map((row) => ({
        id: String(row._id),
        plateNumber: row.plateNumber,
        vehicleCategory: row.vehicleType,
        amount: roundMoney(row.amount),
        paymentMethod: mapWalkupPaymentLabel(row.paymentMethod),
        createdAt: row.checkedInAt,
      })),
      transactions: aggregate.transactions.map((row) => ({
        id: String(row._id),
        amount: roundMoney(row.amount),
        method: mapTransactionMethodLabel(row),
        status: row.status,
        completedAt: row.completedAt,
      })),
    };
  }

  async startShift({ userId }) {
    const scope = await this.#resolveAttendantScope(userId);
    const existing = await this.#findActiveShift(scope.attendantId);
    if (existing) {
      throw new ConflictError("An active shift is already in progress.");
    }

    const shift = await AttendantShift.create({
      attendantId: scope.attendantId,
      branchId: scope.branchId,
      status: "active",
      startedAt: new Date(),
    });

    const aggregate = await this.#aggregateShiftData({
      branchId: scope.branchId,
      shiftStartedAt: shift.startedAt,
    });

    return this.#mapZReportPayload({ shift, scope, aggregate });
  }

  async getCurrentZReport({ userId }) {
    const scope = await this.#resolveAttendantScope(userId);
    const shift = await this.#findActiveShift(scope.attendantId);
    if (!shift) {
      throw new NotFoundError("No active shift found. Clock in to start a shift.");
    }

    const aggregate = await this.#aggregateShiftData({
      branchId: scope.branchId,
      shiftStartedAt: shift.startedAt,
    });

    return this.#mapZReportPayload({ shift, scope, aggregate });
  }

  async closeShift({ userId, cashInHand }) {
    const scope = await this.#resolveAttendantScope(userId);
    const submittedCashInHand = Number(cashInHand);

    if (!Number.isFinite(submittedCashInHand) || submittedCashInHand < 0) {
      throw new ValidationError("cashInHand must be a non-negative number.");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const shift = await AttendantShift.findOne({
        attendantId: scope.attendantId,
        status: "active",
      }).session(session);

      if (!shift) {
        throw new NotFoundError("No active shift found to close.");
      }

      if (shift.shiftReportId) {
        throw new ConflictError("This shift has already been closed.");
      }

      const closedAt = new Date();
      const aggregate = await this.#aggregateShiftData({
        branchId: scope.branchId,
        shiftStartedAt: shift.startedAt,
        currentTime: closedAt,
      });

      const expectedCashInHand = aggregate.totals.expectedCashInHand;
      const cashDifference = roundMoney(submittedCashInHand - expectedCashInHand);
      const shiftDurationMinutes = Math.max(
        0,
        Math.floor((closedAt.getTime() - new Date(shift.startedAt).getTime()) / 60000)
      );

      const report = await ShiftReport.create(
        [
          {
            attendantId: scope.attendantId,
            branchId: scope.branchId,
            shiftId: shift._id,
            shiftStartedAt: shift.startedAt,
            shiftClosedAt: closedAt,
            shiftDurationMinutes,
            totalWalkUps: aggregate.totals.totalWalkUps,
            totalTransactions: aggregate.totals.totalTransactions,
            totalRevenue: aggregate.totals.totalRevenue,
            expectedCashInHand,
            submittedCashInHand: roundMoney(submittedCashInHand),
            cashDifference,
            cashPaymentsTotal: aggregate.totals.cashPayments,
            digitalPaymentsTotal: aggregate.totals.digitalPayments,
            walkUpIds: aggregate.walkUps.map((row) => row._id),
            transactionIds: aggregate.transactions.map((row) => row._id),
            generatedAt: closedAt,
          },
        ],
        { session }
      );

      const savedReport = report[0];
      shift.status = "closed";
      shift.closedAt = closedAt;
      shift.shiftReportId = savedReport._id;
      await shift.save({ session });

      await session.commitTransaction();

      const varianceStatus =
        cashDifference === 0
          ? "EXACT MATCH"
          : cashDifference > 0
            ? "OVERAGE"
            : "SHORTAGE";

      return {
        reportId: String(savedReport._id),
        shiftId: String(shift._id),
        attendant: {
          id: String(scope.attendantId),
          name: scope.attendantName,
          branchName: scope.branchName,
        },
        shift: {
          startedAt: shift.startedAt,
          closedAt,
          duration: formatDuration(shift.startedAt, closedAt),
        },
        totals: {
          ...aggregate.totals,
          submittedCashInHand: roundMoney(submittedCashInHand),
          cashDifference,
        },
        reconciliation: {
          expected: expectedCashInHand,
          actual: roundMoney(submittedCashInHand),
          variance: cashDifference,
          status: varianceStatus,
          cashTransactions:
            aggregate.totals.totalWalkUps + aggregate.totals.totalTransactions,
        },
        generatedAt: savedReport.generatedAt,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = {
  AttendantShiftReportsService,
};
