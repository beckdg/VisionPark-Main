const { AttendantIncident, ATTENDANT_INCIDENT_TYPES } = require("./models/attendant-incident.model");
const { User } = require("../users/models/user.model");
const { ParkingLot } = require("../parking/models/parking-lot.model");
const { Incident } = require("../operations/models/incident.model");
const { NotFoundError, ValidationError } = require("../../common/errors");

const isFleeingType = (t) => t === "Fled Without Payment";

const relativeTime = (dateLike) => {
  const d = new Date(dateLike);
  if (Number.isNaN(d.valueOf())) return "--";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins <= 1) return "Just Now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  if (hours < 48) return "Yesterday";
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
};

class AttendantIncidentsService {
  async #getAttendantScope(userId) {
    const user = await User.findById(userId).select("role name attendant.lotId").lean();
    if (!user) throw new NotFoundError("User not found.");
    if (user.role !== "attendant") {
      throw new ValidationError("Only attendants can access incident logger.");
    }
    if (!user?.attendant?.lotId) {
      throw new ValidationError("Attendant.lotId is required for incident scope.");
    }
    const lot = await ParkingLot.findById(user.attendant.lotId).select("name").lean();
    return {
      lotId: user.attendant.lotId,
      lotName: lot?.name ?? "Assigned Branch",
      attendantName: user?.name ?? "Attendant",
    };
  }

  async #generateIncidentCode() {
    // Short code for UI, collision-safe with retry.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `INC-${Math.floor(100 + Math.random() * 900)}`;
      const exists = await AttendantIncident.exists({ incidentCode: code });
      if (!exists) return code;
    }
    return `INC-${Date.now().toString().slice(-3)}`;
  }

  #toUiRow(doc, lotName) {
    return {
      id: doc.incidentCode,
      attendantIncidentId: doc._id ? String(doc._id) : null,
      plate: doc.offenderPlate,
      type: doc.incidentType,
      details: doc.description,
      amount: typeof doc.amount === "number" ? doc.amount : null,
      time: relativeTime(doc.createdAt),
      status: doc.statusLabel,
      destination: doc.destination,
      branch: lotName,
    };
  }

  async listRecent({ userId, limit = 20 }) {
    const { lotId, lotName } = await this.#getAttendantScope(userId);
    const docs = await AttendantIncident.find({ lotId })
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(100, Number(limit) || 20)))
      .lean();
    return docs.map((d) => this.#toUiRow(d, lotName));
  }

  async createIncident({ userId, payload }) {
    const { lotId, lotName } = await this.#getAttendantScope(userId);
    const incidentType = String(payload?.incidentType || "").trim();
    const description = String(payload?.description || "").trim();
    const offenderPlateInput = String(payload?.offenderPlate || "").trim().toUpperCase();
    const damagedPlatesInput = Array.isArray(payload?.damagedPlates) ? payload.damagedPlates : [];

    if (!ATTENDANT_INCIDENT_TYPES.includes(incidentType)) {
      throw new ValidationError("Invalid incidentType.");
    }
    if (!description) {
      throw new ValidationError("description is required.");
    }

    const isDamage = incidentType === "Property Damage";
    const normalizedPlate = offenderPlateInput || (isDamage ? "UNKNOWN" : "");
    if (!normalizedPlate) {
      throw new ValidationError("offenderPlate is required for this incident type.");
    }

    const amount = isFleeingType(incidentType) ? Number(payload?.amount ?? 0) : null;
    if (isFleeingType(incidentType) && (!Number.isFinite(amount) || amount <= 0)) {
      throw new ValidationError("amount is required and must be > 0 for fleeing incidents.");
    }

    const damagedPlates = damagedPlatesInput
      .map((p) => String(p || "").trim().toUpperCase())
      .filter(Boolean);

    const media = Array.isArray(payload?.media)
      ? payload.media
          .map((m) => ({
            type: m?.type === "video" ? "video" : "photo",
            name: m?.name ? String(m.name) : null,
            data: m?.data ? String(m.data) : null,
          }))
          .slice(0, 10)
      : [];

    const isUnknown = normalizedPlate === "UNKNOWN";
    const destination = isFleeingType(incidentType) ? "debt_radar" : "owner";
    const statusLabel = isUnknown
      ? "Admin CCTV Review Needed"
      : isFleeingType(incidentType)
        ? "Global Watchlist Active"
        : "Pending";

    const incidentCode = await this.#generateIncidentCode();
    const created = await AttendantIncident.create({
      incidentCode,
      lotId,
      attendantId: userId,
      createdById: userId,
      incidentType,
      offenderPlate: normalizedPlate,
      amount,
      description,
      damagedPlates,
      media,
      destination,
      status: "pending",
      statusLabel,
    });

    // Mirror into the core operations Incident stream so owner/admin tooling
    // and existing DB viewers that rely on Incident collection see these logs.
    await Incident.create({
      createdByType: "attendant",
      createdById: userId,
      type: incidentType,
      severity: isFleeingType(incidentType) ? "high" : "medium",
      description,
      plate: normalizedPlate,
      evidence: media
        .map((m) => ({
          url: m?.url || m?.data || m?.name || "attendant-logger-evidence",
          publicId: m?.publicId || null,
          type: m?.type === "video" ? "video" : "image",
          source: "attendant_logger",
          metadata: {
            incidentCode,
            lotId: String(lotId),
          },
        }))
        .slice(0, 10),
      tags: [
        "attendant_logger",
        destination,
        incidentType,
        incidentCode,
      ],
      status: "pending",
    });

    return this.#toUiRow(created.toObject(), lotName);
  }
}

module.exports = {
  AttendantIncidentsService,
};

