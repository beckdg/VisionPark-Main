const { domainEventBus, DOMAIN_EVENTS } = require("../operations/shared/domain-events");
const { AppError, ValidationError } = require("../../common/errors");
const { logger } = require("../../common/logger");
const { validateAIEventPayload, AI_EVENT_TYPES } = require("./contracts");
const { upsertCameraNode } = require("./camera-registry");
const { SessionService } = require("../sessions/session.service");
const { ParkingSession } = require("../sessions/models/parking-session.model");
const { IncidentService } = require("../operations/incidents/incident.service");
const { randomUUID } = require("crypto");
const { markAIProcessed } = require("../../app/runtime-state");

class AIIngestionError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, "AI_INGESTION_ERROR");
  }
}

class AIIngestionService {
  constructor() {
    this.sessionService = new SessionService();
    this.incidentService = new IncidentService();
    this.lowConfidenceThreshold = 0.65;
  }

  async ingestEvent(payload) {
    const correlationId = randomUUID();
    const normalized = validateAIEventPayload(payload);
    const cameraNode = upsertCameraNode({
      cameraId: normalized.cameraId,
      branchId: normalized.metadata.branchId || null,
      zoneId: normalized.metadata.zoneId || null,
      status:
        normalized.eventType === "camera_status"
          ? normalized.metadata.status
          : "online",
      lastSeenAt: normalized.timestamp,
    });

    logger.info("AI raw event received", {
      module: "ai-ingestion.service",
      correlationId,
      eventType: normalized.eventType,
      cameraId: normalized.cameraId,
      confidence: normalized.confidence,
      metadata: normalized.metadata,
    });

    const mappedActions = [];

    if (normalized.eventType === "entry_detected") {
      await this.#handleEntryDetected(normalized, correlationId, cameraNode, mappedActions);
    }

    if (normalized.eventType === "exit_detected") {
      await this.#handleExitDetected(normalized, correlationId, cameraNode, mappedActions);
    }

    if (normalized.eventType === "mismatch_detected") {
      await this.#handleMismatchDetected(normalized, correlationId, cameraNode, mappedActions);
    }

    if (normalized.confidence < this.lowConfidenceThreshold) {
      await this.#createLowConfidenceIncident(normalized, correlationId, cameraNode, mappedActions);
    }

    if (!normalized.metadata.plate || normalized.metadata.plate === "UNKNOWN") {
      this.#emitEnforcementSuggestion(normalized, correlationId, cameraNode, mappedActions);
    }

    if (normalized.eventType === "camera_status" || normalized.eventType === "plate_detected" || normalized.eventType === "vehicle_detected") {
      this.#emitMonitoringEvent(normalized, correlationId, cameraNode, mappedActions);
    }

    logger.info("AI mapped actions completed", {
      module: "ai-ingestion.service",
      correlationId,
      eventType: normalized.eventType,
      cameraId: normalized.cameraId,
      mappedActions,
    });
    markAIProcessed({
      timestamp: new Date().toISOString(),
      correlationId,
    });

    return {
      accepted: true,
      correlationId,
      eventType: normalized.eventType,
      cameraId: normalized.cameraId,
      timestamp: normalized.timestamp,
      mappedActions,
    };
  }

  async #handleEntryDetected(event, correlationId, cameraNode, mappedActions) {
    const sessionId = event.metadata.sessionId || null;
    if (!sessionId) {
      mappedActions.push({ type: "session_secure_skipped", reason: "missing_sessionId" });
      return;
    }

    const session = await this.sessionService.secureSession({
      sessionId,
      idempotencyKey: `ai-entry-secure:${sessionId}:${event.timestamp}`,
    });
    mappedActions.push({ type: "session_secured", sessionId: String(session._id) });
  }

  async #handleExitDetected(event, correlationId, cameraNode, mappedActions) {
    const sessionId = event.metadata.sessionId || null;
    if (!sessionId) {
      mappedActions.push({ type: "session_close_skipped", reason: "missing_sessionId" });
      return;
    }

    const pre = await ParkingSession.findById(sessionId)
      .select("state parkingFeeEtb exitAllowed")
      .lean();
    if (pre?.state === "closed") {
      const fee =
        pre.parkingFeeEtb != null && Number.isFinite(Number(pre.parkingFeeEtb))
          ? Number(pre.parkingFeeEtb)
          : 0;
      if (fee > 0 && pre.exitAllowed !== true) {
        logger.warn("payments.ai_exit_blocked_unpaid_closed", {
          module: "ai-ingestion.service",
          correlationId,
          sessionId: String(sessionId),
        });
        mappedActions.push({
          type: "session_exit_blocked",
          reason: "payment_required_before_exit",
          sessionId: String(sessionId),
        });
        return;
      }
    }

    const session = await this.sessionService.closeSession({
      sessionId,
      idempotencyKey: `ai-exit-close:${sessionId}:${event.timestamp}`,
      closeReason: "ai_exit_detected",
    });
    mappedActions.push({ type: "session_closed", sessionId: String(session._id) });
  }

  async #handleMismatchDetected(event, correlationId, cameraNode, mappedActions) {
    const incident = await this.incidentService.createIncident({
      createdByType: "system",
      type: "AI_MISMATCH_DETECTED",
      severity: "high",
      description: `Mismatch detected by camera ${event.cameraId}`,
      sessionId: event.metadata.sessionId || null,
      spotId: event.metadata.spotId || null,
      plate: event.metadata.plate || null,
      tags: ["ai", "mismatch", "correlation:" + correlationId],
      evidence: event.metadata.evidenceUrl
        ? [{ url: event.metadata.evidenceUrl, type: "image", source: "ai", metadata: { correlationId } }]
        : [],
    });

    domainEventBus.emitEvent(
      DOMAIN_EVENTS.AI_INCIDENT_SUGGESTED,
      {
        correlationId,
        eventType: event.eventType,
        cameraId: event.cameraId,
        branchId: cameraNode.branchId,
        zoneId: cameraNode.zoneId,
        incidentId: String(incident._id),
        suggestionType: "incident",
        timestamp: event.timestamp,
      },
      {
        eventId: `ai-incident-suggested:${correlationId}`,
      }
    );

    mappedActions.push({ type: "incident_created", incidentId: String(incident._id) });
  }

  async #createLowConfidenceIncident(event, correlationId, cameraNode, mappedActions) {
    const incident = await this.incidentService.createIncident({
      createdByType: "system",
      type: "AI_LOW_CONFIDENCE_REVIEW",
      severity: "medium",
      description: `Low confidence (${event.confidence}) detection on camera ${event.cameraId}`,
      sessionId: event.metadata.sessionId || null,
      spotId: event.metadata.spotId || null,
      plate: event.metadata.plate || null,
      tags: ["ai", "low-confidence", "review", "correlation:" + correlationId],
    });

    mappedActions.push({ type: "review_incident_created", incidentId: String(incident._id) });
  }

  #emitEnforcementSuggestion(event, correlationId, cameraNode, mappedActions) {
    domainEventBus.emitEvent(
      DOMAIN_EVENTS.AI_ENFORCEMENT_SUGGESTED,
      {
        correlationId,
        eventType: event.eventType,
        cameraId: event.cameraId,
        branchId: cameraNode.branchId,
        zoneId: cameraNode.zoneId,
        suggestionType: "enforcement",
        reason: "unknown_plate_detected",
        timestamp: event.timestamp,
      },
      {
        eventId: `ai-enforcement-suggested:${correlationId}`,
      }
    );
    mappedActions.push({ type: "enforcement_suggestion_emitted" });
  }

  #emitMonitoringEvent(event, correlationId, cameraNode, mappedActions) {
    domainEventBus.emitEvent(
      DOMAIN_EVENTS.AI_MONITORING_EVENT,
      {
        correlationId,
        eventType: event.eventType,
        cameraId: event.cameraId,
        branchId: cameraNode.branchId,
        zoneId: cameraNode.zoneId,
        status: cameraNode.status,
        timestamp: event.timestamp,
        confidence: event.confidence,
      },
      {
        eventId: `ai-monitoring:${correlationId}`,
      }
    );
    mappedActions.push({ type: "monitoring_event_emitted" });
  }
}

module.exports = {
  AIIngestionService,
  AIIngestionError,
  SUPPORTED_AI_EVENTS: AI_EVENT_TYPES,
};
