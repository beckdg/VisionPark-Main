const AI_EVENT_TYPES = [
  "plate_detected",
  "vehicle_detected",
  "mismatch_detected",
  "entry_detected",
  "exit_detected",
  "camera_status",
];

const baseRequiredFields = ["eventType", "cameraId", "timestamp", "confidence", "metadata"];

const eventSchemas = {
  plate_detected: {
    requiredMetadataFields: ["plate"],
  },
  vehicle_detected: {
    requiredMetadataFields: ["category"],
  },
  mismatch_detected: {
    requiredMetadataFields: ["reason"],
  },
  entry_detected: {
    requiredMetadataFields: [],
  },
  exit_detected: {
    requiredMetadataFields: [],
  },
  camera_status: {
    requiredMetadataFields: ["status"],
  },
};

module.exports = {
  AI_EVENT_TYPES,
  baseRequiredFields,
  eventSchemas,
};
