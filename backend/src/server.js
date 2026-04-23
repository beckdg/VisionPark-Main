const http = require("http");
const { createApp } = require("./app");
const { connectMongo } = require("./database/mongo");
const { env } = require("./config/env");
const { startJobs } = require("./jobs");
const { createRealtimeServer } = require("./realtime");
const { logger } = require("./common/logger");

const startServer = async () => {
  await connectMongo();

  const app = createApp();
  const httpServer = http.createServer(app);
  createRealtimeServer(httpServer);
  startJobs();

  httpServer.listen(env.port, () => {
    logger.info("VisionPark backend listening", {
      module: "server",
      port: env.port,
      nodeEnv: env.nodeEnv,
    });
  });
  console.log("VisionPark backend listening", {
    module: "server",
    port: env.port,
    nodeEnv: env.nodeEnv,
  });
};

startServer().catch((error) => {
  logger.error("Failed to start backend server", {
    module: "server",
    error,
  });
  process.exit(1);
});
