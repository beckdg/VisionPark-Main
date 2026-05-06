const { env } = require("../config/env");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BASE_URL = process.env.API_BASE_URL || `http://localhost:${env.port}`;

const postAIEvent = async (payload) => {
  const response = await fetch(`${BASE_URL}/api/ai/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.aiApiKey,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { status: response.status, body };
};

const run = async () => {
  const sampleSessionId = process.env.SIM_SESSION_ID || null;
  const base = {
    cameraId: "sim-camera-1",
    confidence: 0.93,
    metadata: {
      plate: "SIM-0001",
      category: "car",
      branchId: "demo-branch",
      zoneId: "demo-zone-a",
      sessionId: sampleSessionId,
    },
  };

  const scenario = [
    {
      name: "entry_detected",
      payload: {
        ...base,
        eventType: "entry_detected",
        timestamp: new Date().toISOString(),
      },
    },
    {
      name: "mismatch_detected",
      payload: {
        ...base,
        eventType: "mismatch_detected",
        timestamp: new Date(Date.now() + 2000).toISOString(),
        confidence: 0.61,
        metadata: {
          ...base.metadata,
          reason: "plate_mismatch",
          plate: "UNKNOWN",
        },
      },
    },
    {
      name: "exit_detected",
      payload: {
        ...base,
        eventType: "exit_detected",
        timestamp: new Date(Date.now() + 4000).toISOString(),
      },
    },
  ];

  for (const step of scenario) {
    const result = await postAIEvent(step.payload);
    process.stdout.write(
      `${JSON.stringify({
        step: step.name,
        status: result.status,
        result: result.body,
      })}\n`
    );
    await sleep(1200);
  }
};

run().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exit(1);
});
