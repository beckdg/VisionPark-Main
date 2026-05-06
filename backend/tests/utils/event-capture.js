const { domainEventBus, DOMAIN_EVENTS } = require("../../src/modules/operations/shared/domain-events");

let events = [];
let attached = false;
let listeners = [];

const clonePayload = (payload) => {
  if (payload === undefined) return {};
  return JSON.parse(JSON.stringify(payload));
};

const attachEventCapture = () => {
  if (attached) return;

  const eventNames = Object.values(DOMAIN_EVENTS);
  listeners = eventNames.map((eventName) => {
    const listener = (payload) => {
      events.push({
        name: eventName,
        payload: clonePayload(payload),
        capturedAt: new Date().toISOString(),
      });
    };
    domainEventBus.on(eventName, listener);
    return { eventName, listener };
  });

  attached = true;
};

const detachEventCapture = () => {
  if (!attached) return;

  listeners.forEach(({ eventName, listener }) => {
    domainEventBus.off(eventName, listener);
  });
  listeners = [];
  attached = false;
};

const getEvents = () => [...events];

const clearEvents = () => {
  events = [];
  if (typeof domainEventBus.clearSeenEventIdsForTests === "function") {
    domainEventBus.clearSeenEventIdsForTests();
  }
};

const waitForEventCount = async (minimumCount, timeoutMs = 250) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (events.length >= minimumCount) return getEvents();
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return getEvents();
};

module.exports = {
  attachEventCapture,
  detachEventCapture,
  getEvents,
  clearEvents,
  waitForEventCount,
};
