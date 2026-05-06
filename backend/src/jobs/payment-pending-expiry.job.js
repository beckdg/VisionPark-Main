const { Transaction } = require("../modules/operations/models/transaction.model");
const { TransactionService } = require("../modules/operations/transactions/transaction.service");
const { logger } = require("../common/logger");

const chapaMethodQuery = () => ({ $regex: /^chapa$/i });

class PaymentPendingExpiryJob {
  async runOnce() {
    const transactionService = new TransactionService();
    const now = new Date();
    const pending = await Transaction.find({
      status: "pending",
      expiresAt: { $lte: now, $ne: null },
      method: chapaMethodQuery(),
    })
      .limit(200)
      .lean();

    let expired = 0;
    for (const row of pending) {
      try {
        await transactionService.completeTransaction({
          transactionId: String(row._id),
          status: "failed",
          metadata: {
            checkoutExpired: true,
            expiredAt: now.toISOString(),
            expiredByJob: true,
          },
        });
        expired += 1;
      } catch (error) {
        logger.debug("payments.pending_expiry_skip", {
          module: "payment-pending-expiry.job",
          transactionId: String(row._id),
          message: error?.message,
        });
      }
    }

    if (expired > 0) {
      logger.info("payments.pending_expiry_job", {
        module: "payment-pending-expiry.job",
        expiredCount: expired,
      });
    }
  }
}

module.exports = {
  PaymentPendingExpiryJob,
};
