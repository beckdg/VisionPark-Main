const { EventEmitter } = require("events");
const { logger } = require("../../../common/logger");

const DOMAIN_EVENTS = {
  SESSION_RESERVED: "session.reserved",
  SESSION_SECURED: "session.secured",
  SESSION_EXPIRED: "session.expired",
  SESSION_CLOSED: "session.closed",
  SPOT_STATUS_DERIVED: "spot.status_derived",
  INCIDENT_CREATED: "incident.created",
  ENFORCEMENT_CREATED: "enforcement.created",
  ENFORCEMENT_BLOCK_APPLIED: "enforcement.block_applied",
  TRANSACTION_COMPLETED: "transaction.completed",
  AI_INCIDENT_SUGGESTED: "ai.incident_suggested",
  AI_ENFORCEMENT_SUGGESTED: "ai.enforcement_suggested",
  AI_MONITORING_EVENT: "ai.monitoring_event",
};

class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    this._seenEventIds = new Map();
    this._maxSeen = 5000;
  }

  emitEvent(eventName, payload, options = {}) {
    const eventId = options.eventId || payload?.eventId || null;
    if (eventId) {
      if (this._seenEventIds.has(eventId)) return false;
      this._seenEventIds.set(eventId, Date.now());
      if (this._seenEventIds.size > this._maxSeen) {
        const oldestKey = this._seenEventIds.keys().next().value;
        this._seenEventIds.delete(oldestKey);
      }
    }
    const enrichedPayload = eventId
      ? { ...(payload || {}), eventId }
      : payload;
    try {
      this.emit(eventName, enrichedPayload);
      return true;
    } catch (error) {
      // Never let a listener exception crash request/job flows.
      logger.error("Domain event listener failed", {
        module: "operations.domain-events",
        eventName,
        eventId,
        error,
      });
      return false;
    }
  }

  clearSeenEventIdsForTests() {
    this._seenEventIds.clear();
  }
}

const domainEventBus = new DomainEventBus();

module.exports = {
  domainEventBus,
  DOMAIN_EVENTS,
};
