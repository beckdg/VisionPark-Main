const { ConsistencyAuditService } = require("../modules/operations/shared/consistency-audit.service");
const { logger } = require("../common/logger");
const { randomUUID } = require("crypto");

class ReconciliationJob {
  constructor() {
    this.auditService = new ConsistencyAuditService();
    this.isRunning = false;
    this.maxRetries = 2;
  }

  async runOnce() {
    const requestId = `job-reconciliation-${randomUUID()}`;
    if (this.isRunning) {
      logger.warn("Reconciliation job skipped due to active lock", {
        module: "jobs.reconciliation",
        requestId,
      });
      return { running: true };
    }

    this.isRunning = true;
    try {
      logger.info("Reconciliation job started", {
        module: "jobs.reconciliation",
        requestId,
      });

      let attempt = 0;
      while (attempt < this.maxRetries) {
        attempt += 1;
        try {
          const report = await this.auditService.runAudit({ autoFixSafe: true });
          const summary = {
            sessionDrift: report.sessionDrift.length,
            parkingDrift: report.parkingDrift.length,
            enforcementDrift: report.enforcementDrift.length,
            transactionDrift: report.transactionDrift.length,
          };
          logger.info("Reconciliation job completed", {
            module: "jobs.reconciliation",
            requestId,
            summary,
          });
          return report;
        } catch (error) {
          if (attempt >= this.maxRetries) throw error;
        }
      }
      return { sessionDrift: [], parkingDrift: [], enforcementDrift: [], transactionDrift: [] };
    } catch (error) {
      logger.error("Reconciliation job failed", {
        module: "jobs.reconciliation",
        requestId,
        error,
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = {
  ReconciliationJob,
};
