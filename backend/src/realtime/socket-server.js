const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { registerDomainEventRouter } = require("./event-router");
const { logger } = require("../common/logger");
const { markRealtimeInitialized, setRealtimeConnectedClients } = require("../app/runtime-state");
const { env } = require("../config/env");

const extractToken = (socket) => {
  const auth = socket.handshake?.auth || {};
  const query = socket.handshake?.query || {};
  const rawHeader = socket.handshake?.headers?.authorization || "";
  const [scheme, headerToken] = String(rawHeader).split(/\s+/);
  if (auth.token) return String(auth.token);
  if (auth.accessToken) return String(auth.accessToken);
  if (query.token) return String(query.token);
  if (scheme === "Bearer" && headerToken) return String(headerToken);
  return null;
};

const parseIdentity = (socket) => {
  const token = extractToken(socket);
  if (!token) {
    throw new Error("Missing socket auth token.");
  }
  const decoded = jwt.verify(token, env.jwtSecret);
  if (!decoded?.userId || !decoded?.role) {
    throw new Error("Invalid socket token payload.");
  }
  const userId = String(decoded.userId);
  const role = String(decoded.role);
  return {
    userId,
    role,
    ownerId: role === "owner" ? userId : null,
    branchId: role === "attendant" ? userId : null,
  };
};

const createRealtimeServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });
  markRealtimeInitialized();
  setRealtimeConnectedClients(0);

  const detachDomainRouter = registerDomainEventRouter(io);

  io.use((socket, next) => {
    try {
      const identity = parseIdentity(socket);
      socket.data.identity = identity;
      return next();
    } catch (error) {
      logger.warn("Socket auth rejected", {
        module: "realtime.socket-server",
        socketId: socket.id,
        reason: error?.message || "invalid_token",
      });
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    setRealtimeConnectedClients(io.of("/").sockets.size);

    const {
      userId = null,
      ownerId = null,
      branchId = null,
      role = null,
    } = socket.data.identity || {};
    const joinedRooms = new Set();

    const joinRoom = (room) => {
      if (!room || joinedRooms.has(room)) return;
      socket.join(room);
      joinedRooms.add(room);
    };

    if (userId) joinRoom(`driver:${String(userId)}`);
    if (ownerId) joinRoom(`owner:${String(ownerId)}`);
    if (branchId) joinRoom(`attendant:${String(branchId)}`);
    if (role === "admin") joinRoom("admin:global");

    logger.info("Socket connected", {
      module: "realtime.socket-server",
      socketId: socket.id,
      userId: userId ? String(userId) : null,
      ownerId: ownerId ? String(ownerId) : null,
      branchId: branchId ? String(branchId) : null,
      role: role || null,
      joinedRooms: Array.from(joinedRooms),
    });

    socket.on("disconnect", (reason) => {
      setRealtimeConnectedClients(io.of("/").sockets.size);
      logger.info("Socket disconnected", {
        module: "realtime.socket-server",
        socketId: socket.id,
        reason,
      });
    });

    socket.on("error", (error) => {
      logger.warn("Socket error", {
        module: "realtime.socket-server",
        socketId: socket.id,
        error,
      });
    });
  });

  return {
    io,
    close: async () => {
      detachDomainRouter();
      await io.close();
    },
  };
};

module.exports = {
  createRealtimeServer,
};
