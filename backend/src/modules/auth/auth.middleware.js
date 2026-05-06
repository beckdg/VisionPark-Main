const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { env } = require("../../config/env");
const {
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
} = require("../../common/errors");
const { ParkingSession } = require("../sessions/models/parking-session.model");
const { ParkingLot } = require("../parking/models/parking-lot.model");
const { Transaction } = require("../operations/models/transaction.model");

const authenticate = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(/\s+/);
    if (scheme !== "Bearer" || !token) {
      return next(new UnauthorizedError("Authentication required."));
    }
    const decoded = jwt.verify(token, env.jwtSecret);
    const userId = decoded.userId;
    const role = decoded.role;
    if (!userId || !role) {
      return next(new UnauthorizedError("Invalid token payload."));
    }
    req.user = { userId, role };
    if (req.context) {
      req.context.userId = userId;
    }
    return next();
  } catch (error) {
    if (error && error.name === "TokenExpiredError") {
      return next(new UnauthorizedError("Token expired."));
    }
    return next(new UnauthorizedError("Invalid or expired token."));
  }
};

const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required."));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("You do not have permission for this action."));
    }
    return next();
  };

const requireAiApiKey = (req, res, next) => {
  const key = req.headers["x-api-key"];
  const expected = env.aiApiKey;
  if (!key || typeof key !== "string" || !expected) {
    return next(new UnauthorizedError("Missing or invalid API key."));
  }
  try {
    const a = Buffer.from(key.trim(), "utf8");
    const b = Buffer.from(String(expected), "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return next(new UnauthorizedError("Missing or invalid API key."));
    }
  } catch {
    return next(new UnauthorizedError("Missing or invalid API key."));
  }
  return next();
};

const requireBodyDriverIdMatchesAuthUser = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError("Authentication required."));
  }
  if (req.user.role === "admin") {
    return next();
  }
  const driverId = req.body?.driverId;
  if (!driverId) {
    return next(new ValidationError("driverId is required."));
  }
  if (String(driverId) !== String(req.user.userId)) {
    return next(new ForbiddenError("You may only act for your own driver account."));
  }
  return next();
};

const requireCloseSessionAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required."));
    }
    if (req.user.role === "admin") {
      return next();
    }
    if (req.user.role !== "driver") {
      return next(new ForbiddenError("Only a driver or admin may close a session."));
    }
    const session = await ParkingSession.findById(req.params.sessionId).select("driverId");
    if (!session) {
      return next(new NotFoundError("Session not found."));
    }
    if (String(session.driverId) !== String(req.user.userId)) {
      return next(new ForbiddenError("You can only close your own sessions."));
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireSecureSessionAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required."));
    }
    if (["admin", "attendant"].includes(req.user.role)) {
      return next();
    }
    if (req.user.role !== "driver") {
      return next(new ForbiddenError("Only a driver, attendant, or admin may secure a session."));
    }
    const session = await ParkingSession.findById(req.params.sessionId).select("driverId state");
    if (!session) {
      return next(new NotFoundError("Session not found."));
    }
    if (String(session.driverId) !== String(req.user.userId)) {
      return next(new ForbiddenError("You can only secure your own sessions."));
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireSessionReadAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required."));
    }
    if (["admin", "attendant"].includes(req.user.role)) {
      return next();
    }
    if (req.user.role === "owner") {
      const session = await ParkingSession.findById(req.params.sessionId).select("lotId");
      if (!session) {
        return next(new NotFoundError("Session not found."));
      }
      const lot = await ParkingLot.findById(session.lotId).select("ownerId");
      if (!lot) {
        return next(new NotFoundError("Lot not found."));
      }
      if (String(lot.ownerId) !== String(req.user.userId)) {
        return next(new ForbiddenError("You can only view sessions on your lots."));
      }
      return next();
    }
    if (req.user.role === "driver") {
      const session = await ParkingSession.findById(req.params.sessionId).select("driverId");
      if (!session) {
        return next(new NotFoundError("Session not found."));
      }
      if (String(session.driverId) !== String(req.user.userId)) {
        return next(new ForbiddenError("You can only view your own sessions."));
      }
      return next();
    }
    return next(new ForbiddenError("You do not have permission to view this session."));
  } catch (error) {
    return next(error);
  }
};

const requireLotMutationScope = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required."));
    }
    if (req.user.role === "admin") {
      return next();
    }
    if (req.user.role !== "owner") {
      return next(new ForbiddenError("Only an owner or admin may manage inventory."));
    }
    const ownerId = req.body?.ownerId || req.user.userId;
    if (String(ownerId) !== String(req.user.userId)) {
      return next(new ForbiddenError("ownerId must match your account."));
    }
    req.body.ownerId = String(req.user.userId);
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireZoneSpotLotOwnedByUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required."));
    }
    if (req.user.role === "admin") {
      return next();
    }
    if (req.user.role !== "owner") {
      return next(new ForbiddenError("Only an owner or admin may manage inventory."));
    }
    const lotId = req.body?.lotId;
    if (!lotId) {
      return next(new ValidationError("lotId is required."));
    }
    const lot = await ParkingLot.findById(lotId).select("ownerId");
    if (!lot) {
      return next(new NotFoundError("Lot not found."));
    }
    if (String(lot.ownerId) !== String(req.user.userId)) {
      return next(new ForbiddenError("You may only manage zones and spots on your own lots."));
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireTransactionAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required."));
    }
    if (req.user.role === "admin") {
      return next();
    }
    if (req.user.role !== "driver") {
      return next(new ForbiddenError("Only a driver or admin may access this transaction."));
    }
    const tx = await Transaction.findById(req.params.transactionId).select("driverId");
    if (!tx) {
      return next(new NotFoundError("Transaction not found."));
    }
    if (String(tx.driverId) !== String(req.user.userId)) {
      return next(new ForbiddenError("You can only access your own transactions."));
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireUserSelfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError("Authentication required."));
  }
  if (req.user.role === "admin") {
    return next();
  }
  if (String(req.params.id) !== String(req.user.userId)) {
    return next(new ForbiddenError("You can only view your own profile."));
  }
  return next();
};

module.exports = {
  authenticate,
  authorize,
  requireAiApiKey,
  requireBodyDriverIdMatchesAuthUser,
  requireSecureSessionAccess,
  requireCloseSessionAccess,
  requireSessionReadAccess,
  requireLotMutationScope,
  requireZoneSpotLotOwnedByUser,
  requireTransactionAccess,
  requireUserSelfOrAdmin,
};
