const aiRoutes = require("./ai.routes");
const { AIIngestionService, AIIngestionError, SUPPORTED_AI_EVENTS } = require("./ai.service");
const { validateAIEventPayload, eventSchemas, baseRequiredFields } = require("./contracts");
const { upsertCameraNode, getCameraNode, listCameraNodes } = require("./camera-registry");

module.exports = {
  aiRoutes,
  AIIngestionService,
  AIIngestionError,
  SUPPORTED_AI_EVENTS,
  validateAIEventPayload,
  eventSchemas,
  baseRequiredFields,
  upsertCameraNode,
  getCameraNode,
  listCameraNodes,
};
