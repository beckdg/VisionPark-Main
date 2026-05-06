const { Incident, INCIDENT_STATUSES } = require("../models/incident.model");
const { domainEventBus, DOMAIN_EVENTS } = require("../shared/domain-events");
const { AppError, ValidationError, NotFoundError, ConflictError } = require("../../../common/errors");

class IncidentError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, "INCIDENT_ERROR");
  }
}

class IncidentService {
  async createIncident(payload) {
    const {
      createdByType,
      createdById = null,
      type,
      severity = "medium",
      description = null,
      sessionId = null,
      spotId = null,
      plate = null,
      evidence = [],
      tags = [],
    } = payload;

    if (!createdByType || !["attendant", "system"].includes(createdByType)) {
      throw new ValidationError("createdByType must be attendant or system.");
    }
    if (!type) {
      throw new ValidationError("type is required.");
    }

    const incident = await Incident.create({
      createdByType,
      createdById,
      type,
      severity,
      description,
      sessionId,
      spotId,
      plate,
      evidence,
      tags,
      status: "pending",
    });

    domainEventBus.emitEvent(DOMAIN_EVENTS.INCIDENT_CREATED, {
      incidentId: incident._id,
      type: incident.type,
      status: incident.status,
      createdByType: incident.createdByType,
      sessionId: incident.sessionId,
      spotId: incident.spotId,
      plate: incident.plate,
      at: new Date(),
    }, {
      eventId: `incident-created:${String(incident._id)}:${incident.__v}`,
    });

    return incident;
  }

  async transitionStatus({ incidentId, toStatus }) {
    if (!INCIDENT_STATUSES.includes(toStatus)) {
      throw new ValidationError("Invalid incident status.");
    }

    const incident = await Incident.findById(incidentId);
    if (!incident) throw new NotFoundError("Incident not found.");

    const validNextStates = {
      pending: ["under_review"],
      under_review: ["resolved", "escalated"],
      resolved: [],
      escalated: [],
    };

    if (!validNextStates[incident.status].includes(toStatus)) {
      throw new ConflictError(
        `Invalid status transition from ${incident.status} to ${toStatus}.`,
      );
    }

    incident.status = toStatus;
    await incident.save();
    return incident;
  }

  async getById(incidentId) {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new NotFoundError("Incident not found.");
    return incident;
  }
}

module.exports = {
  IncidentService,
  IncidentError,
};
