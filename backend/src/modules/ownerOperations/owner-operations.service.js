const { AttendantIncident } = require("../attendantIncidents/models/attendant-incident.model");
const { ParkingLot } = require("../parking/models/parking-lot.model");
const { User } = require("../users/models/user.model");
const { NotFoundError, ValidationError } = require("../../common/errors");
const mongoose = require("mongoose");

const formatDateTime = (dateLike) => {
  const d = new Date(dateLike);
  if (Number.isNaN(d.valueOf())) return "--";
  return d.toLocaleString();
};

class OwnerOperationsService {
  #normalizeStatus(doc) {
    const raw = String(doc?.status || "").toLowerCase();
    if (raw === "resolved" || raw === "forwarded" || raw === "pending") return raw;
    const label = String(doc?.statusLabel || "").toLowerCase();
    if (label.includes("resolved")) return "resolved";
    if (label.includes("forwarded")) return "forwarded";
    return "pending";
  }

  async #getOwnerScope(ownerId) {
    const owner = await User.findById(ownerId).select("_id role").lean();
    if (!owner) throw new NotFoundError("Owner not found.");
    if (owner.role !== "owner") throw new ValidationError("Only owners can access owner operations incidents.");

    const lots = await ParkingLot.find({ ownerId }).select("_id name").lean();
    const lotIds = lots.map((l) => l._id);
    const lotNameById = new Map(lots.map((l) => [String(l._id), l.name]));
    return { lotIds, lotNameById };
  }

  #toOwnerIncident(doc, lotNameById, attendantById) {
    const lotName = lotNameById.get(String(doc.lotId)) || "Current Branch";
    const attendant = attendantById.get(String(doc.attendantId));
    const hasVideo = (doc.media || []).some((m) => m.type === "video");
    const hasPhoto = (doc.media || []).some((m) => m.type === "photo");
    const firstWithUrl = (doc.media || []).find((m) => m.url);
    const firstFile =
      firstWithUrl?.url || (doc.media || []).find((m) => m.data)?.data || (doc.media || [])[0]?.data || null;
    const plates =
      doc.incidentType === "Property Damage"
        ? (doc.damagedPlates && doc.damagedPlates.length ? doc.damagedPlates : [doc.offenderPlate])
        : [doc.offenderPlate];

    const status = this.#normalizeStatus(doc);
    const statusLabel =
      status === "resolved"
        ? "Resolved"
        : status === "forwarded"
          ? "Forwarded to Authority"
          : "Pending";

    return {
      id: doc.incidentCode,
      branch: lotName,
      zone: "N/A",
      spot: "N/A",
      createdAt: doc.createdAt,
      date: formatDateTime(doc.createdAt),
      plates,
      category: doc.incidentType,
      description: doc.description,
      attendantName: attendant?.name || "Attendant",
      attendantId: attendant?._id ? String(attendant._id) : null,
      status,
      statusLabel,
      hasVideo,
      hasPhoto,
      file: firstFile,
      amount: typeof doc.amount === "number" ? doc.amount : 0,
      isDebtRadar: doc.destination === "debt_radar",
      destination: doc.destination,
    };
  }

  async getOwnerIncidents({ ownerId }) {
    const { lotIds, lotNameById } = await this.#getOwnerScope(ownerId);
    if (!lotIds.length) return { incidents: [], debtRadar: [] };

    const docs = await AttendantIncident.find({ lotId: { $in: lotIds } })
      .sort({ createdAt: -1 })
      .lean();

    const attendantIds = Array.from(new Set(docs.map((d) => String(d.attendantId)).filter(Boolean)));
    const attendants = attendantIds.length
      ? await User.find({ _id: { $in: attendantIds } }).select("_id name").lean()
      : [];
    const attendantById = new Map(attendants.map((a) => [String(a._id), a]));

    const mapped = docs.map((d) => this.#toOwnerIncident(d, lotNameById, attendantById));
    return {
      incidents: mapped.filter((m) => !m.isDebtRadar || m.status !== "pending"),
      debtRadar: mapped.filter((m) => m.isDebtRadar && m.status === "pending"),
    };
  }

  async updateOwnerIncidentStatus({ ownerId, incidentId, status }) {
    const { lotIds } = await this.#getOwnerScope(ownerId);
    if (!lotIds.length) throw new NotFoundError("No owner branches found.");
    if (!incidentId) throw new ValidationError("incidentId is required.");
    if (!status) throw new ValidationError("status is required.");

    const incoming = String(status).trim().toLowerCase();
    const normalizedStatus =
      incoming === "resolved"
        ? "resolved"
        : incoming === "forwarded" || incoming === "forwarded to authority"
          ? "forwarded"
          : incoming === "pending" || incoming === "pending review"
            ? "pending"
            : null;
    if (!normalizedStatus) {
      throw new ValidationError("Invalid status value.");
    }

    const queryById = mongoose.Types.ObjectId.isValid(incidentId)
      ? { $or: [{ _id: incidentId }, { incidentCode: incidentId }] }
      : { incidentCode: incidentId };

    const updated = await AttendantIncident.findOneAndUpdate(
      { lotId: { $in: lotIds }, ...queryById },
      {
        $set: {
          status: normalizedStatus,
          statusLabel:
            normalizedStatus === "resolved"
              ? "Resolved"
              : normalizedStatus === "forwarded"
                ? "Forwarded to Authority"
                : "Pending",
        },
      },
      { new: true }
    );
    if (!updated) throw new NotFoundError("Incident not found for your branches.");

    return { id: updated.incidentCode, status: updated.status };
  }
}

module.exports = {
  OwnerOperationsService,
};

