const { domainEventBus, DOMAIN_EVENTS } = require("../modules/operations/shared/domain-events");
const { logger } = require("../common/logger");

const toStringOrNull = (value) => (value === undefined || value === null ? null : String(value));
const seenEventIds = new Map();
const maxSeenEventIds = 10000;

const emitToRoomIfPresent = (io, room, eventName, payload) => {
  if (!room) return;
  io.to(room).emit(eventName, payload);
};

const registerDomainEventRouter = (io) => {
  const listeners = [];

  const on = (eventName, handler) => {
    domainEventBus.on(eventName, handler);
    listeners.push({ eventName, handler });
  };

  const shouldForward = (payload = {}) => {
    const eventId = payload.eventId || null;
    if (!eventId) return true;
    if (seenEventIds.has(eventId)) return false;
    seenEventIds.set(eventId, Date.now());
    if (seenEventIds.size > maxSeenEventIds) {
      const oldest = seenEventIds.keys().next().value;
      seenEventIds.delete(oldest);
    }
    return true;
  };

  const sessionForwarder = (payload) => {
    if (!shouldForward(payload)) return;
    logger.info("Forwarding session event to realtime rooms", {
      module: "realtime.event-router",
      eventName: payload.state ? `session.${payload.state}` : "session.update",
      sessionId: payload.sessionId || null,
      requestId: payload.requestId || null,
      userId: payload.driverId || null,
    });
    emitToRoomIfPresent(io, `driver:${toStringOrNull(payload.driverId)}`, payload.state ? `session.${payload.state}` : "session.update", payload);
    emitToRoomIfPresent(io, `attendant:${toStringOrNull(payload.lotId || payload.branchId)}`, payload.state ? `session.${payload.state}` : "session.update", payload);
    io.to("admin:global").emit(payload.state ? `session.${payload.state}` : "session.update", payload);
  };

  on(DOMAIN_EVENTS.SESSION_RESERVED, sessionForwarder);
  on(DOMAIN_EVENTS.SESSION_SECURED, sessionForwarder);
  on(DOMAIN_EVENTS.SESSION_EXPIRED, sessionForwarder);
  on(DOMAIN_EVENTS.SESSION_CLOSED, sessionForwarder);

  on(DOMAIN_EVENTS.SPOT_STATUS_DERIVED, (payload) => {
    if (!shouldForward(payload)) return;
    emitToRoomIfPresent(
      io,
      `attendant:${toStringOrNull(payload.lotId || payload.branchId)}`,
      "parking.spot_updated",
      payload
    );
    emitToRoomIfPresent(
      io,
      `owner:${toStringOrNull(payload.ownerId)}`,
      "parking.spot_updated",
      payload
    );
    io.to("admin:global").emit("parking.spot_updated", payload);
  });

  const enforcementForwarder = (payload) => {
    if (!shouldForward(payload)) return;
    emitToRoomIfPresent(
      io,
      `owner:${toStringOrNull(payload.ownerId)}`,
      "enforcement.update",
      payload
    );
    emitToRoomIfPresent(
      io,
      `attendant:${toStringOrNull(payload.lotId || payload.branchId)}`,
      "enforcement.update",
      payload
    );
    io.to("admin:global").emit("enforcement.update", payload);
  };

  on(DOMAIN_EVENTS.ENFORCEMENT_CREATED, enforcementForwarder);
  on(DOMAIN_EVENTS.ENFORCEMENT_BLOCK_APPLIED, enforcementForwarder);

  on(DOMAIN_EVENTS.TRANSACTION_COMPLETED, (payload) => {
    if (!shouldForward(payload)) return;
    logger.info("Forwarding transaction completion event", {
      module: "realtime.event-router",
      eventName: "transaction.completed",
      transactionId: payload.transactionId || null,
      userId: payload.driverId || null,
    });
    emitToRoomIfPresent(
      io,
      `driver:${toStringOrNull(payload.driverId)}`,
      "transaction.completed",
      payload
    );
    emitToRoomIfPresent(
      io,
      `owner:${toStringOrNull(payload.ownerId)}`,
      "transaction.completed",
      payload
    );
    io.to("admin:global").emit("transaction.completed", payload);
  });

  return () => {
    logger.info("Detaching realtime domain event listeners", {
      module: "realtime.event-router",
    });
    listeners.forEach(({ eventName, handler }) => {
      domainEventBus.off(eventName, handler);
    });
  };
};

module.exports = {
  registerDomainEventRouter,
};
