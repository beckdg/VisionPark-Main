const { SessionService } = require("./session.service");

const sessionService = new SessionService();

const createReservation = async (req, res, next) => {
  try {
    const session = await sessionService.createReservation({
      driverId: req.body.driverId,
      lotId: req.body.lotId,
      zoneId: req.body.zoneId,
      spotId: req.body.spotId,
      expiresAt: req.body.expiresAt,
      paymentRequired: req.body.paymentRequired,
      idempotencyKey: req.body.idempotencyKey,
    });

    return res.status(201).json(session);
  } catch (error) {
    return next(error);
  }
};

const secureSession = async (req, res, next) => {
  try {
    const session = await sessionService.secureSession({
      sessionId: req.params.sessionId,
      idempotencyKey: req.body.idempotencyKey,
    });
    return res.status(200).json(session);
  } catch (error) {
    return next(error);
  }
};

const expireSession = async (req, res, next) => {
  try {
    const session = await sessionService.expireSession({
      sessionId: req.params.sessionId,
      idempotencyKey: req.body.idempotencyKey,
    });
    return res.status(200).json(session);
  } catch (error) {
    return next(error);
  }
};

const closeSession = async (req, res, next) => {
  try {
    const session = await sessionService.closeSession({
      sessionId: req.params.sessionId,
      idempotencyKey: req.body.idempotencyKey,
      closeReason: req.body.closeReason,
      actor: req.user
        ? {
            userId: req.user.userId,
            role: req.user.role,
            bypassExitPayment: Boolean(req.body?.bypassExitPayment),
            bypassReason: req.body?.bypassReason,
          }
        : null,
    });
    return res.status(200).json(session);
  } catch (error) {
    return next(error);
  }
};

const getSessionById = async (req, res, next) => {
  try {
    const session = await sessionService.getById(req.params.sessionId);
    return res.status(200).json(session);
  } catch (error) {
    return next(error);
  }
};

const getMyActiveSession = async (req, res, next) => {
  try {
    const session = await sessionService.getActiveSessionForUser({
      userId: req.user.userId,
      role: req.user.role,
    });
    return res.status(200).json(session);
  } catch (error) {
    return next(error);
  }
};

const getMySessions = async (req, res, next) => {
  try {
    const sessions = await sessionService.getMySessions(req.user.userId);
    return res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    return next(error);
  }
};

const getExitEligibility = async (req, res, next) => {
  try {
    const data = await sessionService.getExitEligibilitySnapshot(req.params.sessionId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const validatePhysicalExit = async (req, res, next) => {
  try {
    await sessionService.assertPhysicalExitAllowed(req.params.sessionId);
    return res.status(200).json({ success: true, data: { allowed: true } });
  } catch (error) {
    return next(error);
  }
};

const postExitOverride = async (req, res, next) => {
  try {
    const session = await sessionService.allowExitOverride({
      sessionId: req.params.sessionId,
      userId: req.user.userId,
      role: req.user.role,
      reason: req.body?.reason,
    });
    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createReservation,
  secureSession,
  expireSession,
  closeSession,
  getSessionById,
  getMyActiveSession,
  getMySessions,
  getExitEligibility,
  validatePhysicalExit,
  postExitOverride,
};
