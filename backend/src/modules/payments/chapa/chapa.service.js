const axios = require("axios");
const { env } = require("../../../config/env");
const { logger } = require("../../../common/logger");
const { Transaction } = require("../../operations/models/transaction.model");
const { ParkingSession } = require("../../sessions/models/parking-session.model");
const { User } = require("../../users/models/user.model");
const { TransactionService } = require("../../operations/transactions/transaction.service");
const {
  AppError,
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} = require("../../../common/errors");

const CHAPA_METHOD_REGEX = /^chapa$/i;
const PENDING_CHECKOUT_MS = 15 * 60 * 1000;
const VERIFY_AMOUNT_TOLERANCE = 0.01;

class ChapaServiceError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, "CHAPA_ERROR");
  }
}

const chapaMethodQuery = () => ({ $regex: CHAPA_METHOD_REGEX });

const buildParkingBreakdown = (session) => {
  const securedAt = session?.securedAt;
  const closedAt = session?.closedAt;
  let hours = null;
  if (securedAt && closedAt) {
    const ms = Math.max(0, new Date(closedAt).getTime() - new Date(securedAt).getTime());
    hours = Number((ms / (1000 * 60 * 60)).toFixed(4));
  }
  const mult =
    session?.appliedHourlyRateEtb != null && Number.isFinite(Number(session.appliedHourlyRateEtb))
      ? Number(session.appliedHourlyRateEtb)
      : null;
  const base =
    session?.parkingFeeEtb != null && Number.isFinite(Number(session.parkingFeeEtb))
      ? Number(Number(session.parkingFeeEtb).toFixed(2))
      : null;
  return {
    baseFee: base,
    overstayFee: 0,
    hours,
    multiplier: mult,
  };
};

class ChapaService {
  constructor() {
    this.transactionService = new TransactionService();
  }

  #requireConfig() {
    if (!env.chapaSecretKey) {
      throw new ValidationError("Chapa is not configured (missing CHAPA_SECRET_KEY).");
    }
  }

  #baseUrl() {
    return String(env.chapaBaseUrl || "https://api.chapa.co/v1").replace(/\/$/, "");
  }

  #headers() {
    return {
      Authorization: `Bearer ${env.chapaSecretKey}`,
      "Content-Type": "application/json",
    };
  }

  buildParkingTxRef(sessionId) {
    return `parking:${String(sessionId)}`;
  }

  async #computeClosedParkingAmount(session) {
    if (session.state !== "closed") {
      throw new ValidationError("Parking payment is only available after the session is closed.");
    }
    const pf = session.parkingFeeEtb;
    if (pf == null || !Number.isFinite(Number(pf)) || Number(pf) < 0) {
      throw new ValidationError(
        "Parking fee is not set for this session. It is computed when the session closes."
      );
    }
    return Number(Number(pf).toFixed(2));
  }

  amountsRoughlyEqual(a, b, tolerance = VERIFY_AMOUNT_TOLERANCE) {
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return Math.abs(x - y) <= tolerance;
  }

  async #failPendingAsExpired(transaction) {
    if (transaction.status !== "pending") return transaction;
    return this.transactionService.completeTransaction({
      transactionId: String(transaction._id),
      status: "failed",
      metadata: {
        checkoutExpired: true,
        expiredAt: new Date().toISOString(),
      },
    });
  }

  /**
   * If pending Chapa checkout passed expiresAt, mark failed (idempotent).
   * @returns {Promise<boolean>} true if expiry was applied this call
   */
  async maybeExpirePendingCheckout(transaction) {
    if (!transaction || transaction.status !== "pending") return false;
    if (!transaction.expiresAt) return false;
    if (new Date(transaction.expiresAt).getTime() > Date.now()) return false;
    await this.#failPendingAsExpired(transaction, "checkout_expired");
    logger.warn("payments.chapa_pending_expired", {
      module: "chapa.service",
      transactionId: String(transaction._id),
      sessionId: String(transaction.sessionId),
      expiresAt: transaction.expiresAt,
    });
    return true;
  }

  async findChapaTransactionByTxRef(tx_ref) {
    return Transaction.findOne({
      idempotencyKey: String(tx_ref || "").trim(),
      method: chapaMethodQuery(),
    });
  }

  async ensurePendingParkingTransaction({ sessionId, driverId, amount, tx_ref, breakdown, expiresAt }) {
    const existingSuccess = await Transaction.findOne({
      sessionId,
      status: "success",
      "metadata.type": "parking_fee",
    })
      .select("_id")
      .lean();
    if (existingSuccess) {
      throw new ConflictError("Parking fee is already paid for this session.");
    }

    let doc = await Transaction.findOne({
      sessionId,
      idempotencyKey: tx_ref,
    });

    if (doc?.status === "success" && doc.metadata?.type === "parking_fee") {
      throw new ConflictError("Parking fee is already paid for this session.");
    }

    if (doc?.status === "pending") {
      if (Math.abs(Number(doc.amount) - amount) > 0.02) {
        doc = await Transaction.findByIdAndUpdate(
          doc._id,
          {
            $set: {
              amount,
              breakdown,
              expiresAt,
              "metadata.type": "parking_fee",
              "metadata.chapaTxRef": tx_ref,
            },
          },
          { new: true }
        );
      } else {
        await Transaction.findByIdAndUpdate(doc._id, {
          $set: { expiresAt, breakdown },
        });
        doc = await Transaction.findById(doc._id);
      }
      return doc;
    }

    if (doc?.status === "failed") {
      return Transaction.findByIdAndUpdate(
        doc._id,
        {
          $set: {
            status: "pending",
            amount,
            currency: "ETB",
            method: "chapa",
            provider: null,
            breakdown,
            expiresAt,
            providerRef: null,
            completedAt: null,
            "metadata.type": "parking_fee",
            "metadata.chapaTxRef": tx_ref,
          },
        },
        { new: true }
      );
    }

    return this.transactionService.createPendingTransaction({
      sessionId,
      driverId,
      amount,
      currency: "ETB",
      method: "chapa",
      provider: null,
      breakdown,
      expiresAt,
      idempotencyKey: tx_ref,
      metadata: { type: "parking_fee", chapaTxRef: tx_ref },
    });
  }

  async initializeParkingPayment({ sessionId, driverUserId }) {
    this.#requireConfig();
    if (!env.chapaCallbackUrl || !env.chapaReturnUrl) {
      throw new ValidationError("CHAPA_CALLBACK_URL and CHAPA_RETURN_URL must be set.");
    }

    const session = await ParkingSession.findById(sessionId).lean();
    if (!session) throw new NotFoundError("Session not found.");
    if (String(session.driverId) !== String(driverUserId)) {
      throw new ForbiddenError("You can only pay for your own parking sessions.");
    }

    const amount = await this.#computeClosedParkingAmount(session);
    if (amount <= 0) {
      throw new ValidationError("Nothing to pay for this session.");
    }

    const tx_ref = this.buildParkingTxRef(sessionId);
    const expiresAt = new Date(Date.now() + PENDING_CHECKOUT_MS);
    const breakdown = buildParkingBreakdown(session);

    logger.info("payments.chapa_initialize_request", {
      module: "chapa.service",
      sessionId: String(sessionId),
      driverId: String(driverUserId),
      amount,
      currency: "ETB",
      tx_ref,
      expiresAt: expiresAt.toISOString(),
    });

    const transaction = await this.ensurePendingParkingTransaction({
      sessionId,
      driverId: driverUserId,
      amount,
      tx_ref,
      breakdown,
      expiresAt,
    });

    const driver = await User.findById(driverUserId).select("name email").lean();
    if (!driver) throw new NotFoundError("Driver not found.");

    const fullName = String(driver.name || "Driver").trim() || "Driver";
    const parts = fullName.split(/\s+/).filter(Boolean);
    const first_name = parts[0] || "Driver";
    const last_name = parts.slice(1).join(" ") || first_name;
    const email = String(driver.email || "").trim();
    if (!email) {
      throw new ValidationError("Your account must have an email address to pay with Chapa.");
    }

    const body = {
      amount: String(amount),
      currency: "ETB",
      email,
      first_name,
      last_name,
      tx_ref,
      callback_url: env.chapaCallbackUrl,
      return_url: env.chapaReturnUrl,
      customization: {
        title: "Parking Fee Payment",
        description: "VisionPark parking session payment",
      },
    };

    let chapaData;
    try {
      const response = await axios.post(`${this.#baseUrl()}/transaction/initialize`, body, {
        headers: this.#headers(),
        timeout: 30_000,
      });
      chapaData = response.data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to reach Chapa.";
      logger.error("payments.chapa_initialize_http_error", {
        module: "chapa.service",
        sessionId: String(sessionId),
        tx_ref,
        error: err?.response?.data || err?.message,
      });
      throw new ChapaServiceError(`Chapa initialize failed: ${msg}`, 502);
    }

    const checkout_url =
      chapaData?.data?.checkout_url || chapaData?.data?.checkout_url_legacy || null;
    if (!checkout_url || String(chapaData?.status || "").toLowerCase() !== "success") {
      const message = chapaData?.message || "Chapa did not return a checkout URL.";
      logger.warn("payments.chapa_initialize_bad_payload", {
        module: "chapa.service",
        sessionId: String(sessionId),
        tx_ref,
        chapaStatus: chapaData?.status,
      });
      throw new ChapaServiceError(message, 502);
    }

    await Transaction.findByIdAndUpdate(transaction._id, {
      $set: {
        "metadata.chapaCheckoutUrl": checkout_url,
        "metadata.chapaLastInitializeAt": new Date().toISOString(),
      },
    });

    logger.info("payments.chapa_initialize_success", {
      module: "chapa.service",
      sessionId: String(sessionId),
      tx_ref,
      transactionId: String(transaction._id),
    });

    return {
      checkout_url,
      tx_ref,
      transactionId: transaction._id,
      amount,
      currency: "ETB",
      expiresAt,
    };
  }

  async verifyRemoteTransaction(tx_ref) {
    this.#requireConfig();
    const encoded = encodeURIComponent(String(tx_ref).trim());
    try {
      const response = await axios.get(`${this.#baseUrl()}/transaction/verify/${encoded}`, {
        headers: this.#headers(),
        timeout: 30_000,
      });
      return response.data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Chapa verify request failed.";
      throw new ChapaServiceError(msg, 502);
    }
  }

  #verifyRemoteMatchesLocal({ remote, data, transaction }) {
    const remoteStatus = String(data?.status || remote?.status || "").toLowerCase();
    if (remoteStatus !== "success") {
      return { ok: false, reason: "remote_not_success", remoteStatus };
    }
    const remoteCurrency = String(data?.currency || remote?.currency || "ETB")
      .trim()
      .toUpperCase();
    if (remoteCurrency !== "ETB") {
      logger.error("payments.chapa_verify_currency_mismatch", {
        module: "chapa.service",
        transactionId: String(transaction._id),
        expected: "ETB",
        received: remoteCurrency,
      });
      return { ok: false, reason: "currency_mismatch", remoteCurrency };
    }
    const remoteAmount = data?.amount ?? data?.charged_amount;
    if (!this.amountsRoughlyEqual(remoteAmount, transaction.amount, VERIFY_AMOUNT_TOLERANCE)) {
      logger.error("payments.chapa_verify_amount_mismatch", {
        module: "chapa.service",
        transactionId: String(transaction._id),
        localAmount: transaction.amount,
        remoteAmount,
      });
      return { ok: false, reason: "amount_mismatch", remoteAmount };
    }
    return { ok: true };
  }

  async #markSessionPaid(sessionId) {
    await ParkingSession.findByIdAndUpdate(sessionId, {
      $set: {
        paymentStatus: "paid",
        exitAllowed: true,
      },
    });
  }

  /**
   * @returns {{ outcome: "success" | "failed" | "pending" | "expired", transactionId?: *, sessionId?: * }}
   */
  async syncTransactionWithChapa(tx_ref, { source = "sync" } = {}) {
    this.#requireConfig();
    const cleanRef = String(tx_ref || "").trim();
    if (!cleanRef) {
      throw new ValidationError("tx_ref is required.");
    }

    let transaction = await this.findChapaTransactionByTxRef(cleanRef);
    if (!transaction) {
      throw new NotFoundError("No matching local transaction for this reference.");
    }

    await this.maybeExpirePendingCheckout(transaction);
    transaction = await this.findChapaTransactionByTxRef(cleanRef);
    if (!transaction) {
      throw new NotFoundError("No matching local transaction for this reference.");
    }

    if (transaction.status === "failed" && transaction.metadata?.checkoutExpired) {
      logger.info("payments.chapa_callback_result", {
        module: "chapa.service",
        source,
        tx_ref: cleanRef,
        outcome: "expired",
      });
      return {
        outcome: "expired",
        transactionId: transaction._id,
        sessionId: transaction.sessionId,
      };
    }

    if (transaction.status === "success") {
      await this.#markSessionPaid(transaction.sessionId);
      logger.info("payments.chapa_callback_result", {
        module: "chapa.service",
        source,
        tx_ref: cleanRef,
        outcome: "success_already_finalized",
      });
      return {
        outcome: "success",
        transactionId: transaction._id,
        sessionId: transaction.sessionId,
      };
    }

    if (transaction.status === "failed") {
      logger.info("payments.chapa_callback_result", {
        module: "chapa.service",
        source,
        tx_ref: cleanRef,
        outcome: "failed_already_finalized",
      });
      return {
        outcome: "failed",
        transactionId: transaction._id,
        sessionId: transaction.sessionId,
      };
    }

    const remote = await this.verifyRemoteTransaction(cleanRef);
    const data = remote?.data && typeof remote.data === "object" ? remote.data : remote;
    const remoteStatus = String(data?.status || remote?.status || "").toLowerCase();

    if (remoteStatus !== "success") {
      const terminalFail = ["failed", "cancelled", "rejected", "error"].includes(remoteStatus);
      if (terminalFail) {
        await this.transactionService.completeTransaction({
          transactionId: String(transaction._id),
          status: "failed",
          providerRef: data?.reference ? String(data.reference) : null,
          metadata: { chapaVerifyStatus: remoteStatus, verifySource: source },
        });
        logger.info("payments.chapa_callback_result", {
          module: "chapa.service",
          source,
          tx_ref: cleanRef,
          outcome: "failed",
        });
        return {
          outcome: "failed",
          transactionId: transaction._id,
          sessionId: transaction.sessionId,
        };
      }
      logger.info("payments.chapa_callback_result", {
        module: "chapa.service",
        source,
        tx_ref: cleanRef,
        outcome: "pending",
      });
      return {
        outcome: "pending",
        transactionId: transaction._id,
        sessionId: transaction.sessionId,
      };
    }

    const check = this.#verifyRemoteMatchesLocal({ remote, data, transaction });
    if (!check.ok) {
      await this.transactionService.completeTransaction({
        transactionId: String(transaction._id),
        status: "failed",
        providerRef: data?.reference ? String(data.reference) : null,
        metadata: {
          chapaVerifyAnomaly: true,
          anomalyReason: check.reason,
          remoteCurrency: check.remoteCurrency ?? null,
          remoteAmount: check.remoteAmount != null ? String(check.remoteAmount) : null,
          verifySource: source,
        },
      });
      logger.error("payments.chapa_verify_anomaly_failed_tx", {
        module: "chapa.service",
        source,
        tx_ref: cleanRef,
        reason: check.reason,
      });
      throw new ConflictError("Chapa verification did not match the stored transaction.");
    }

    const providerRef =
      String(data?.reference || data?.chapa_reference || data?.ref_id || "").trim() || null;

    await this.transactionService.completeTransaction({
      transactionId: String(transaction._id),
      status: "success",
      providerRef: providerRef || String(data?.trx_id || "").trim() || null,
      metadata: {
        chapaVerify: {
          status: remote?.status || null,
          message: remote?.message || null,
          source,
        },
      },
    });

    await this.#markSessionPaid(transaction.sessionId);

    logger.info("payments.chapa_callback_result", {
      module: "chapa.service",
      source,
      tx_ref: cleanRef,
      outcome: "success",
    });

    return {
      outcome: "success",
      transactionId: transaction._id,
      sessionId: transaction.sessionId,
    };
  }

  async getVerifiedStatusForDriver({ tx_ref, driverUserId }) {
    const cleanRef = String(tx_ref || "").trim();
    if (!cleanRef) throw new ValidationError("tx_ref is required.");

    const transaction = await this.findChapaTransactionByTxRef(cleanRef)
      .select("sessionId driverId status amount completedAt providerRef idempotencyKey expiresAt")
      .lean();

    if (!transaction) throw new NotFoundError("Transaction not found.");
    if (String(transaction.driverId) !== String(driverUserId)) {
      throw new ForbiddenError("You cannot view this payment.");
    }

    let live = await Transaction.findById(transaction._id);
    if (live?.status === "pending") {
      await this.maybeExpirePendingCheckout(live);
    }
    live = await Transaction.findById(transaction._id);
    if (live?.status === "pending") {
      try {
        await this.syncTransactionWithChapa(cleanRef, { source: "driver_verify_poll" });
      } catch (err) {
        if (err instanceof ConflictError) throw err;
      }
    }

    const latest = await Transaction.findById(transaction._id)
      .select("status amount completedAt providerRef idempotencyKey expiresAt")
      .lean();
    if (!latest) throw new NotFoundError("Transaction not found.");

    return {
      tx_ref: cleanRef,
      status: latest.status,
      amount: latest.amount,
      completedAt: latest.completedAt,
      providerRef: latest.providerRef,
      expiresAt: latest.expiresAt,
    };
  }

  async handleWebhookPayload(body, { requestId = null } = {}) {
    const payload = body && typeof body === "object" ? body : {};
    const tx_ref = String(
      payload.tx_ref ||
        payload.trx_ref ||
        payload.data?.tx_ref ||
        payload.data?.trx_ref ||
        ""
    ).trim();
    if (!tx_ref) {
      logger.warn("payments.chapa_webhook_missing_tx_ref", { module: "chapa.service", requestId });
      throw new ValidationError("tx_ref missing from webhook payload.");
    }
    logger.info("payments.chapa_webhook_received", {
      module: "chapa.service",
      requestId,
      tx_ref,
    });
    const result = await this.syncTransactionWithChapa(tx_ref, { source: "webhook" });
    logger.info("payments.chapa_webhook_result", {
      module: "chapa.service",
      requestId,
      tx_ref,
      outcome: result.outcome,
    });
    return result;
  }

  async getDebugSnapshot(tx_ref) {
    this.#requireConfig();
    const cleanRef = String(tx_ref || "").trim();
    if (!cleanRef) throw new ValidationError("tx_ref is required.");
    const transaction = await Transaction.findOne({
      idempotencyKey: cleanRef,
      method: chapaMethodQuery(),
    }).lean();
    const session = transaction
      ? await ParkingSession.findById(transaction.sessionId).lean()
      : null;
    let chapaVerification = null;
    try {
      chapaVerification = await this.verifyRemoteTransaction(cleanRef);
    } catch (err) {
      chapaVerification = { error: err?.message || String(err) };
    }
    return { transaction, session, chapaVerification };
  }
}

module.exports = {
  ChapaService,
  ChapaServiceError,
  chapaMethodQuery,
  PENDING_CHECKOUT_MS,
};
