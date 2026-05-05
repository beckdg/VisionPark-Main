const { ReservationExpiryJob } = require("./reservation-expiry.job");
const { ReconciliationJob } = require("./reconciliation.job");
const { PaymentPendingExpiryJob } = require("./payment-pending-expiry.job");
const { logger } = require("../common/logger");
const { env } = require("../config/env");
const { markJobsInitialized, markJobHeartbeat } = require("../app/runtime-state");

const reservationExpiryJob = new ReservationExpiryJob();
const reconciliationJob = new ReconciliationJob();
const paymentPendingExpiryJob = new PaymentPendingExpiryJob();

const sanitizeIntervalMs = (value, fallback, name) => {
  const n = Number(value);
  // Guard against NaN, negatives, and zero/near-zero loops that can peg CPU.
  if (!Number.isFinite(n) || n < 1000) {
    logger.warn("Invalid job interval; using fallback", {
      module: "jobs.index",
      name,
      provided: value,
      fallback,
    });
    return fallback;
  }
  return n;
};

const startJobs = (options = {}) => {
  const reservationIntervalMs = sanitizeIntervalMs(
    options.reservationIntervalMs || env.reservationExpiryJobMs,
    15000,
    "reservationExpiryJobMs"
  );
  const reconciliationIntervalMs = sanitizeIntervalMs(
    options.reconciliationIntervalMs || env.reconciliationJobMs,
    30000,
    "reconciliationJobMs"
  );
  const paymentPendingExpiryIntervalMs = sanitizeIntervalMs(
    options.paymentPendingExpiryIntervalMs || env.paymentPendingExpiryJobMs,
    60000,
    "paymentPendingExpiryJobMs"
  );

  markJobsInitialized();

  reservationExpiryJob.runOnce().catch((error) => {
    logger.error("Initial reservation expiry job run failed", {
      module: "jobs.index",
      error,
    });
  });
  reconciliationJob.runOnce().catch((error) => {
    logger.error("Initial reconciliation job run failed", {
      module: "jobs.index",
      error,
    });
  });
  paymentPendingExpiryJob.runOnce().catch((error) => {
    logger.error("Initial payment pending expiry job run failed", {
      module: "jobs.index",
      error,
    });
  });

  const reservationTimer = setInterval(() => {
    markJobHeartbeat();
    reservationExpiryJob.runOnce().catch((error) => {
      logger.error("Reservation expiry job run failed", {
        module: "jobs.index",
        error,
      });
    });
  }, reservationIntervalMs);
  reservationTimer.unref();

  const reconciliationTimer = setInterval(() => {
    markJobHeartbeat();
    reconciliationJob.runOnce().catch((error) => {
      logger.error("Reconciliation job run failed", {
        module: "jobs.index",
        error,
      });
    });
  }, reconciliationIntervalMs);
  reconciliationTimer.unref();

  const paymentPendingExpiryTimer = setInterval(() => {
    markJobHeartbeat();
    paymentPendingExpiryJob.runOnce().catch((error) => {
      logger.error("Payment pending expiry job run failed", {
        module: "jobs.index",
        error,
      });
    });
  }, paymentPendingExpiryIntervalMs);
  paymentPendingExpiryTimer.unref();

  return {
    stop() {
      clearInterval(reservationTimer);
      clearInterval(reconciliationTimer);
      clearInterval(paymentPendingExpiryTimer);
    },
    reservationExpiryJob,
    reconciliationJob,
    paymentPendingExpiryJob,
  };
};

module.exports = {
  startJobs,
  reservationExpiryJob,
  reconciliationJob,
  paymentPendingExpiryJob,
};
