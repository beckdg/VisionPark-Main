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

module.exports = {
  createReservation,
  secureSession,
  expireSession,
  closeSession,
  getSessionById,
  getMyActiveSession,
  getMySessions,
};
