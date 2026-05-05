const { env } = require("../../../config/env");
const { logger } = require("../../../common/logger");
const { ChapaService } = require("./chapa.service");

const chapaService = new ChapaService();

const initializeParkingPayment = async (req, res, next) => {
  try {
    const sessionId = req.body?.sessionId;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "sessionId is required." },
      });
    }

    const result = await chapaService.initializeParkingPayment({
      sessionId,
      driverUserId: req.user.userId,
    });

    return res.status(200).json({
      success: true,
      data: {
        checkout_url: result.checkout_url,
        tx_ref: result.tx_ref,
        transactionId: result.transactionId,
        amount: result.amount,
        currency: result.currency,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const chapaCallback = async (req, res, next) => {
  try {
    if (!env.chapaReturnUrl) {
      return res.status(500).send("CHAPA_RETURN_URL is not configured.");
    }

    const tx_ref = String(req.query?.tx_ref || req.query?.trx_ref || "").trim();
    const returnUrl = new URL(env.chapaReturnUrl);

    if (tx_ref) {
      returnUrl.searchParams.set("tx_ref", tx_ref);
      try {
        const result = await chapaService.syncTransactionWithChapa(tx_ref, { source: "http_callback" });
        returnUrl.searchParams.set("payment", result.outcome);
        logger.info("payments.chapa_http_callback", {
          module: "chapa.controller",
          requestId: req.context?.requestId,
          tx_ref,
          outcome: result.outcome,
        });
      } catch (err) {
        returnUrl.searchParams.set("payment", "error");
        if (err?.message) {
          returnUrl.searchParams.set("reason", String(err.message).slice(0, 200));
        }
        logger.warn("payments.chapa_http_callback_error", {
          module: "chapa.controller",
          requestId: req.context?.requestId,
          tx_ref,
          error: err?.message || String(err),
        });
      }
    } else {
      returnUrl.searchParams.set("payment", "missing_tx_ref");
    }

    return res.redirect(302, returnUrl.toString());
  } catch (error) {
    return next(error);
  }
};

const verifyByTxRef = async (req, res, next) => {
  try {
    const tx_ref = String(req.params?.tx_ref || "").trim();
    const summary = await chapaService.getVerifiedStatusForDriver({
      tx_ref,
      driverUserId: req.user.userId,
    });
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    return next(error);
  }
};

const chapaWebhook = async (req, res, next) => {
  try {
    if (env.chapaWebhookSecret) {
      logger.debug("payments.chapa_webhook_secret_configured", {
        module: "chapa.controller",
        requestId: req.context?.requestId,
        hint: "Add signature verification when Chapa webhook signing is confirmed for this deployment.",
      });
    }

    const result = await chapaService.handleWebhookPayload(req.body || {}, {
      requestId: req.context?.requestId,
    });
    return res.status(200).json({ received: true, outcome: result.outcome });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ received: false, message: error.message });
    }
    if (error?.statusCode === 409 || error?.statusCode === 404) {
      logger.warn("payments.chapa_webhook_handled_error", {
        module: "chapa.controller",
        requestId: req.context?.requestId,
        code: error?.code,
        message: error?.message,
      });
      return res.status(200).json({
        received: true,
        outcome: "error",
        message: error.message,
      });
    }
    return next(error);
  }
};

const debugByTxRef = async (req, res, next) => {
  try {
    const tx_ref = String(req.params?.tx_ref || "").trim();
    const snapshot = await chapaService.getDebugSnapshot(tx_ref);
    return res.status(200).json({ success: true, data: snapshot });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  initializeParkingPayment,
  chapaCallback,
  verifyByTxRef,
  chapaWebhook,
  debugByTxRef,
};
