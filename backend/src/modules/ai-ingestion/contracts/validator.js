const { ValidationError } = require("../../../common/errors");
const { AI_EVENT_TYPES, baseRequiredFields, eventSchemas } = require("./schemas");

const isValidUtcDateString = (value) => {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf());
};

const validateAIEventPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("AI event payload must be an object.");
  }

  for (const field of baseRequiredFields) {
    if (payload[field] === undefined || payload[field] === null) {
      throw new ValidationError(`Missing required AI event field: ${field}.`);
    }
  }

  if (!AI_EVENT_TYPES.includes(payload.eventType)) {
    throw new ValidationError(`Unsupported AI event type: ${payload.eventType}.`);
  }

  if (typeof payload.cameraId !== "string" || payload.cameraId.trim().length === 0) {
    throw new ValidationError("cameraId must be a non-empty string.");
  }

  if (!isValidUtcDateString(payload.timestamp)) {
    throw new ValidationError("timestamp must be a valid UTC datetime string.");
  }

  if (typeof payload.confidence !== "number" || payload.confidence < 0 || payload.confidence > 1) {
    throw new ValidationError("confidence must be a number between 0 and 1.");
  }

  if (typeof payload.metadata !== "object" || Array.isArray(payload.metadata)) {
    throw new ValidationError("metadata must be an object.");
  }

  const schema = eventSchemas[payload.eventType];
  for (const metadataField of schema.requiredMetadataFields) {
    if (payload.metadata[metadataField] === undefined || payload.metadata[metadataField] === null) {
      throw new ValidationError(
        `Missing required metadata field for ${payload.eventType}: ${metadataField}.`
      );
    }
  }

  return {
    eventType: payload.eventType,
    cameraId: payload.cameraId.trim(),
    timestamp: new Date(payload.timestamp).toISOString(),
    confidence: payload.confidence,
    metadata: payload.metadata,
  };
};

module.exports = {
  validateAIEventPayload,
};
