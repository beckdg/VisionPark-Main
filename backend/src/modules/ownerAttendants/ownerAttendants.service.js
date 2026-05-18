const mongoose = require("mongoose");
const { User } = require("../users/models/user.model");
const { ParkingLot } = require("../parking/models/parking-lot.model");
const { ShiftReport } = require("../attendantShiftReports/models/shift-report.model");
const { AttendantShift } = require("../attendantShiftReports/models/attendant-shift.model");
const { WalkupCheckin } = require("../attendantWalkup/models/walkup-checkin.model");
const { Transaction } = require("../operations/models/transaction.model");
const { AttendantIncident } = require("../attendantIncidents/models/attendant-incident.model");
const { AttendantLiveGridLeaveInstruction } = require("../attendantLiveGrid/models/attendant-spot-leave-instruction.model");
const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} = require("../../common/errors");

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const formatDurationMinutes = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
};

const mapTransactionMethodLabel = (txn) => {
  const method = String(txn?.method || "").trim().toLowerCase();
  if (method === "chapa") return "Chapa";
  const provider = String(txn?.provider || "").trim().toLowerCase();
  if (provider === "telebirr") return "Telebirr";
  if (provider === "visa") return "Card";
  if (provider === "cbe") return "CBE";
  if (!provider && method === "manual") return "Cash";
  return method ? method.charAt(0).toUpperCase() + method.slice(1) : "Digital";
};

const resolveProfileImage = (user) =>
  user?.profileImageUrl || user?.avatarUrl || null;

class OwnerAttendantsService {
  async #resolveOwnerScope(ownerUserId) {
    if (!ownerUserId) {
      throw new ValidationError("Owner identity is required.");
    }

    const lots = await ParkingLot.find({ ownerId: ownerUserId })
      .select("_id name")
      .sort({ name: 1 })
      .lean();

    const lotIds = lots.map((lot) => lot._id);
    const lotNameById = new Map(lots.map((lot) => [String(lot._id), lot.name]));

    return {
      ownerId: String(ownerUserId),
      lotIds,
      lots,
      lotNameById,
    };
  }

  async #assertAttendantOwnedByOwner(ownerScope, attendantId) {
    const attendant = await User.findOne({
      _id: attendantId,
      role: "attendant",
      "attendant.ownerId": ownerScope.ownerId,
      "attendant.lotId": { $in: ownerScope.lotIds },
    })
      .select(
        "name email avatarUrl profileImageUrl status createdAt updatedAt attendant"
      )
      .lean();

    if (!attendant) {
      throw new NotFoundError("Attendant not found.");
    }

    return attendant;
  }

  async listBranches({ ownerUserId }) {
    const scope = await this.#resolveOwnerScope(ownerUserId);
    return scope.lots.map((lot) => ({
      id: String(lot._id),
      name: lot.name,
    }));
  }

  async #buildAttendantStats(attendantId) {
    const [reports, activeShift, walkUpCount, resolvedIncidents, leaveInstructions] =
      await Promise.all([
        ShiftReport.find({ attendantId })
          .select(
            "totalRevenue shiftDurationMinutes totalWalkUps generatedAt shiftClosedAt"
          )
          .lean(),
        AttendantShift.findOne({ attendantId, status: "active" })
          .select("startedAt")
          .lean(),
        WalkupCheckin.countDocuments({ attendantId }),
        AttendantIncident.countDocuments({
          attendantId,
          status: "resolved",
        }),
        AttendantLiveGridLeaveInstruction.countDocuments({ attendantId }),
      ]);

    const totalRevenueGenerated = roundMoney(
      reports.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0)
    );
    const totalShiftsWorked = reports.length;
    const averageShiftRevenue =
      totalShiftsWorked > 0
        ? roundMoney(totalRevenueGenerated / totalShiftsWorked)
        : 0;

    const lastReportAt = reports.reduce((latest, row) => {
      const candidate = row.shiftClosedAt || row.generatedAt;
      if (!candidate) return latest;
      if (!latest || new Date(candidate) > new Date(latest)) return candidate;
      return latest;
    }, null);

    const user = await User.findById(attendantId).select("updatedAt").lean();

    const lastActiveAt =
      lastReportAt ||
      (activeShift?.startedAt ?? null) ||
      user?.updatedAt ||
      null;

    return {
      totalRevenueGenerated,
      totalShiftsWorked,
      averageShiftRevenue,
      totalWalkUps: walkUpCount,
      totalConflictsHandled: resolvedIncidents,
      spotManagementActions: leaveInstructions,
      currentShiftStatus: activeShift ? "on_shift" : "off_shift",
      lastActiveAt,
    };
  }

  async listAttendants({ ownerUserId, branchId }) {
    const scope = await this.#resolveOwnerScope(ownerUserId);

    const query = {
      role: "attendant",
      "attendant.ownerId": scope.ownerId,
      "attendant.lotId": { $in: scope.lotIds },
    };

    if (branchId) {
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        throw new ValidationError("branchId must be a valid id.");
      }
      const branchStr = String(branchId);
      if (!scope.lotIds.some((id) => String(id) === branchStr)) {
        throw new ForbiddenError("Branch is not owned by this account.");
      }
      query["attendant.lotId"] = branchId;
    }

    const attendants = await User.find(query)
      .select(
        "name email avatarUrl profileImageUrl status createdAt attendant.phone attendant.lotId attendant.faydaId attendant.shiftStart attendant.shiftEnd"
      )
      .sort({ createdAt: -1 })
      .lean();

    const attendantIds = attendants.map((row) => row._id);

    const [reportAgg, activeShifts] = await Promise.all([
      attendantIds.length
        ? ShiftReport.aggregate([
            { $match: { attendantId: { $in: attendantIds } } },
            {
              $group: {
                _id: "$attendantId",
                totalRevenueGenerated: { $sum: "$totalRevenue" },
                totalShiftsWorked: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
      attendantIds.length
        ? AttendantShift.find({
            attendantId: { $in: attendantIds },
            status: "active",
          })
            .select("attendantId")
            .lean()
        : Promise.resolve([]),
    ]);

    const statsByAttendant = new Map(
      reportAgg.map((row) => [
        String(row._id),
        {
          totalRevenueGenerated: roundMoney(row.totalRevenueGenerated),
          totalShiftsWorked: Number(row.totalShiftsWorked || 0),
        },
      ])
    );

    const activeSet = new Set(activeShifts.map((row) => String(row.attendantId)));

    return attendants.map((row) => {
      const stats = statsByAttendant.get(String(row._id)) || {
        totalRevenueGenerated: 0,
        totalShiftsWorked: 0,
      };
      const lotId = row?.attendant?.lotId;

      return {
        id: String(row._id),
        fullName: row.name,
        email: row.email,
        phone: row?.attendant?.phone || null,
        profileImage: resolveProfileImage(row),
        employeeId: row?.attendant?.faydaId || null,
        branch: {
          id: lotId ? String(lotId) : null,
          name: lotId ? scope.lotNameById.get(String(lotId)) || "Unassigned" : "Unassigned",
        },
        currentShiftStatus: activeSet.has(String(row._id)) ? "on_shift" : "off_shift",
        totalRevenueGenerated: stats.totalRevenueGenerated,
        totalShiftsWorked: stats.totalShiftsWorked,
        shiftStart: row?.attendant?.shiftStart || null,
        shiftEnd: row?.attendant?.shiftEnd || null,
        createdAt: row.createdAt,
        status: row.status,
      };
    });
  }

  async getAttendantDetails({ ownerUserId, attendantId }) {
    if (!mongoose.Types.ObjectId.isValid(attendantId)) {
      throw new ValidationError("attendantId must be a valid id.");
    }

    const scope = await this.#resolveOwnerScope(ownerUserId);
    const attendant = await this.#assertAttendantOwnedByOwner(scope, attendantId);

    const lotId = attendant?.attendant?.lotId;
    const branchName = lotId
      ? scope.lotNameById.get(String(lotId)) || "Unassigned"
      : "Unassigned";

    const [stats, shiftReports, recentIncidents] = await Promise.all([
      this.#buildAttendantStats(attendantId),
      ShiftReport.find({ attendantId })
        .sort({ shiftClosedAt: -1 })
        .limit(50)
        .lean(),
      AttendantIncident.find({ attendantId })
        .sort({ createdAt: -1 })
        .limit(8)
        .select(
          "incidentCode incidentType offenderPlate amount status statusLabel createdAt lotId"
        )
        .lean(),
    ]);

    return {
      attendant: {
        id: String(attendant._id),
        fullName: attendant.name,
        email: attendant.email,
        phone: attendant?.attendant?.phone || null,
        profileImage: resolveProfileImage(attendant),
        employeeId: attendant?.attendant?.faydaId || null,
        address: attendant?.attendant?.address || null,
        shiftStart: attendant?.attendant?.shiftStart || null,
        shiftEnd: attendant?.attendant?.shiftEnd || null,
        branch: {
          id: lotId ? String(lotId) : null,
          name: branchName,
        },
        joinedAt: attendant.createdAt,
        status: attendant.status,
      },
      stats,
      shifts: shiftReports.map((row) => ({
        id: String(row._id),
        reportDocumentId: String(row._id),
        shiftId: String(row.shiftId),
        startedAt: row.shiftStartedAt,
        endedAt: row.shiftClosedAt,
        durationMinutes: row.shiftDurationMinutes,
        duration: formatDurationMinutes(row.shiftDurationMinutes),
        totalRevenue: roundMoney(row.totalRevenue),
        totalWalkUps: Number(row.totalWalkUps || 0),
        expectedCashInHand: roundMoney(row.expectedCashInHand),
        submittedCashInHand: roundMoney(row.submittedCashInHand),
        cashDifference: roundMoney(row.cashDifference),
        status: "closed",
      })),
      recentIncidents: recentIncidents.map((row) => ({
        id: String(row._id),
        code: row.incidentCode,
        type: row.incidentType,
        plate: row.offenderPlate,
        amount: row.amount != null ? roundMoney(row.amount) : null,
        status: row.status,
        statusLabel: row.statusLabel,
        branchName: scope.lotNameById.get(String(row.lotId)) || branchName,
        createdAt: row.createdAt,
      })),
      operations: {
        spotManagementActions: stats.spotManagementActions,
        paymentSummary: {
          cashPaymentsTotal: roundMoney(
            shiftReports.reduce((sum, row) => sum + Number(row.cashPaymentsTotal || 0), 0)
          ),
          digitalPaymentsTotal: roundMoney(
            shiftReports.reduce((sum, row) => sum + Number(row.digitalPaymentsTotal || 0), 0)
          ),
        },
      },
    };
  }

  async getShiftReport({ ownerUserId, reportId }) {
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      throw new ValidationError("reportId must be a valid id.");
    }

    const scope = await this.#resolveOwnerScope(ownerUserId);

    const report = await ShiftReport.findById(reportId).lean();
    if (!report) {
      throw new NotFoundError("Shift report not found.");
    }

    if (!scope.lotIds.some((id) => String(id) === String(report.branchId))) {
      throw new ForbiddenError("You do not have access to this shift report.");
    }

    await this.#assertAttendantOwnedByOwner(scope, report.attendantId);

    const attendant = await User.findById(report.attendantId)
      .select("name email attendant.phone attendant.faydaId profileImageUrl avatarUrl")
      .lean();

    const [walkUps, transactions] = await Promise.all([
      report.walkUpIds?.length
        ? WalkupCheckin.find({ _id: { $in: report.walkUpIds } })
            .select(
              "plateNumber vehicleType amount paymentMethod checkedInAt transactionCode receiptCode status"
            )
            .sort({ checkedInAt: -1 })
            .lean()
        : Promise.resolve([]),
      report.transactionIds?.length
        ? Transaction.find({ _id: { $in: report.transactionIds } })
            .select("amount method provider status completedAt metadata")
            .sort({ completedAt: -1 })
            .lean()
        : Promise.resolve([]),
    ]);

    const varianceStatus =
      Number(report.cashDifference) === 0
        ? "EXACT MATCH"
        : Number(report.cashDifference) > 0
          ? "OVERAGE"
          : "SHORTAGE";

    return {
      source: {
        collection: "shiftreports",
        documentId: String(report._id),
      },
      reportId: String(report._id),
      shiftId: String(report.shiftId),
      attendant: {
        id: String(report.attendantId),
        name: attendant?.name || "Attendant",
        email: attendant?.email || null,
        phone: attendant?.attendant?.phone || null,
        employeeId: attendant?.attendant?.faydaId || null,
        profileImage: resolveProfileImage(attendant),
      },
      branch: {
        id: String(report.branchId),
        name: scope.lotNameById.get(String(report.branchId)) || "Branch",
      },
      shift: {
        startedAt: report.shiftStartedAt,
        closedAt: report.shiftClosedAt,
        durationMinutes: report.shiftDurationMinutes,
        duration: formatDurationMinutes(report.shiftDurationMinutes),
      },
      totals: {
        totalWalkUps: Number(report.totalWalkUps || 0),
        totalTransactions: Number(report.totalTransactions || 0),
        totalRevenue: roundMoney(report.totalRevenue),
        expectedCashInHand: roundMoney(report.expectedCashInHand),
        submittedCashInHand: roundMoney(report.submittedCashInHand),
        cashDifference: roundMoney(report.cashDifference),
        cashPaymentsTotal: roundMoney(report.cashPaymentsTotal),
        digitalPaymentsTotal: roundMoney(report.digitalPaymentsTotal),
      },
      reconciliation: {
        expected: roundMoney(report.expectedCashInHand),
        submitted: roundMoney(report.submittedCashInHand),
        variance: roundMoney(report.cashDifference),
        status: varianceStatus,
      },
      walkUps: walkUps.map((row) => ({
        id: String(row._id),
        plateNumber: row.plateNumber,
        vehicleCategory: row.vehicleType,
        amount: roundMoney(row.amount),
        paymentMethod: row.paymentMethod || "cash",
        createdAt: row.checkedInAt,
        receiptCode: row.receiptCode,
        transactionCode: row.transactionCode,
        status: row.status,
      })),
      transactions: transactions.map((row) => ({
        id: String(row._id),
        amount: roundMoney(row.amount),
        method: mapTransactionMethodLabel(row),
        status: row.status,
        completedAt: row.completedAt,
        type: row?.metadata?.type || null,
      })),
      generatedAt: report.generatedAt,
      notes: report.notes || null,
    };
  }
}

module.exports = {
  OwnerAttendantsService,
};
