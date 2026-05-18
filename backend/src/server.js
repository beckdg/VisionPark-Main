const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const http = require("http");
const { createApp } = require("./app");
const { connectMongo } = require("./database/mongo");
const { env } = require("./config/env");
const { startJobs } = require("./jobs");
const { createRealtimeServer } = require("./realtime");
const { logger } = require("./common/logger");

const MONGO_RETRY_DELAY_MS = 5_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForDatabase = async () => {
  let jobsStarted = false;
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      await connectMongo();
      if (!jobsStarted) {
        startJobs();
        jobsStarted = true;
      }
      console.log("MongoDB connected");
      return;
    } catch (error) {
      console.error(
        `[VisionPark] MongoDB connection failed (attempt ${attempt}): ${error.message}`
      );
      console.error(
        `[VisionPark] Using MONGO_URI from backend/.env — retrying in ${MONGO_RETRY_DELAY_MS / 1000}s...`
      );
      await sleep(MONGO_RETRY_DELAY_MS);
    }
  }
};

const startServer = async () => {
  await waitForDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);
  createRealtimeServer(httpServer);

  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(env.port, () => {
      logger.info("VisionPark backend listening", {
        module: "server",
        port: env.port,
        nodeEnv: env.nodeEnv,
        database: "connected",
      });
      console.log(`Server running on port ${env.port}`);
      resolve();
    });
  });
};

startServer().catch((error) => {
  logger.error("Failed to start HTTP server", {
    module: "server",
    error: {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    },
  });
  console.error("[VisionPark] HTTP server error:", error?.message || error);
  process.exit(1);
});
