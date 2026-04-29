const { AIException, AI_EXCEPTION_STATUSES } = require("./models/ai-exception.model");
const { User } = require("../users/models/user.model");
const { NotFoundError, ValidationError, ConflictError } = require("../../common/errors");

const isPlateType = (type) => type === "UNREADABLE_PLATE" || type === "EXIT_MISMATCH";
const PENDING_STATUSES = ["PENDING", "pending"];
const RESOLVED_STATUSES = ["RESOLVED", "resolved"];
const DISMISSED_STATUSES = ["DISMISSED", "dismissed"];

const toRelativeTime = (dateLike) => {
  const d = new Date(dateLike);
  if (Number.isNaN(d.valueOf())) return "--";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "Just Now";
  const mins = Math.floor(diffMs / 60000);
  if (mins <= 1) return "Just Now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatConfidence = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  const normalized = n <= 1 ? n * 100 : n;
  return `${Math.max(0, Math.min(100, Math.round(normalized)))}%`;
};

class AttendantAIExceptionsService {
  async #getAttendantScope(userId) {
    const user = await User.findById(userId).select("role attendant.lotId").lean();
    if (!user) throw new NotFoundError("User not found.");
    if (user.role !== "attendant") throw new ValidationError("Only attendants can access AI exceptions.");
    if (!user?.attendant?.lotId) {
      throw new ValidationError("Attendant.lotId is required for AI exceptions scope.");
    }
    return { lotId: user.attendant.lotId };
  }

  #toUiRow(doc) {
    const guessPlate = doc?.ai?.guessPlate || null;
    const guessCategory = doc?.ai?.guessCategory || null;
    const aiGuess = guessPlate || guessCategory || "UNKNOWN";
    return {
      id: doc.exceptionCode || String(doc._id),
      type: doc.type,
      location: doc?.display?.locationLabel || "Unknown Location",
      time: toRelativeTime(doc.createdAt),
      aiConfidence: formatConfidence(doc?.ai?.confidence),
      aiGuess,
      issue: doc?.display?.issueText || doc?.ai?.rawReason || "AI anomaly detected.",
      image: doc?.evidence?.imageUrl || null,
      status:
        String(doc.status).toUpperCase() === "PENDING"
          ? "Pending"
          : String(doc.status).toUpperCase() === "RESOLVED"
            ? "Resolved"
            : "Dismissed",
      createdAt: doc.createdAt,
      resolution: doc?.resolution || null,
    };
  }

  async listForAttendant({ userId, query }) {
    const { lotId } = await this.#getAttendantScope(userId);
    const requestedStatus = String(query?.status || "pending").toUpperCase();
    const mappedStatus =
      requestedStatus === "RESOLVED"
        ? RESOLVED_STATUSES
        : requestedStatus === "DISMISSED"
          ? DISMISSED_STATUSES
          : PENDING_STATUSES;

    const dbQuery = { lotId, status: { $in: mappedStatus } };
    const search = String(query?.search || "").trim();
    if (search) {
      dbQuery.$or = [
        { exceptionCode: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
      ];
    }

    const rows = await AIException.find(dbQuery).sort({ createdAt: -1 }).lean();
    return rows.map((row) => this.#toUiRow(row));
  }

  async getOneForAttendant({ userId, exceptionId }) {
    const { lotId } = await this.#getAttendantScope(userId);
    const doc = await AIException.findOne({
      lotId,
      $or: [{ _id: exceptionId }, { exceptionCode: exceptionId }],
    }).lean();
    if (!doc) throw new NotFoundError("AI exception not found.");
    return this.#toUiRow(doc);
  }

  async resolveForAttendant({ userId, exceptionId, payload }) {
    const { lotId } = await this.#getAttendantScope(userId);
    const doc = await AIException.findOne({
      lotId,
      $or: [{ _id: exceptionId }, { exceptionCode: exceptionId }],
    });
    if (!doc) throw new NotFoundError("AI exception not found.");
    if (!PENDING_STATUSES.includes(String(doc.status))) {
      throw new ConflictError("Only pending exceptions can be resolved.");
    }

    const correctedPlate = payload?.correctedPlate ? String(payload.correctedPlate).trim().toUpperCase() : "";
    const correctedCategory = payload?.correctedCategory ? String(payload.correctedCategory).trim() : "";
    const notes = payload?.notes ? String(payload.notes).trim() : null;

    if (isPlateType(doc.type)) {
      if (!correctedPlate) {
        throw new ValidationError("correctedPlate is required for this exception type.");
      }
      doc.resolution.correctedPlate = correctedPlate;
      doc.resolution.correctedCategory = null;
    } else if (doc.type === "CATEGORY_MISMATCH") {
      if (!correctedCategory) {
        throw new ValidationError("correctedCategory is required for CATEGORY_MISMATCH.");
      }
      doc.resolution.correctedCategory = correctedCategory;
      doc.resolution.correctedPlate = null;
    }

    doc.resolution.notes = notes;
    doc.resolution.resolvedBy = userId;
    doc.resolution.resolvedAt = new Date();
    doc.status = "RESOLVED";
    await doc.save();

    return this.#toUiRow(doc.toObject());
  }

  async getStatsForAttendant({ userId }) {
    const { lotId } = await this.#getAttendantScope(userId);
    const [pending, resolved, dismissed] = await Promise.all([
      AIException.countDocuments({ lotId, status: { $in: PENDING_STATUSES } }),
      AIException.countDocuments({ lotId, status: { $in: RESOLVED_STATUSES } }),
      AIException.countDocuments({ lotId, status: { $in: DISMISSED_STATUSES } }),
    ]);
    return {
      pending,
      resolved,
      dismissed,
      statuses: AI_EXCEPTION_STATUSES,
    };
  }
}

module.exports = {
  AttendantAIExceptionsService,
};

