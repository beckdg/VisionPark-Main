const runtimeState = {
  startedAt: new Date().toISOString(),
  jobs: {
    initialized: false,
    lastHeartbeatAt: null,
  },
  realtime: {
    initialized: false,
    connectedClients: 0,
  },
  ai: {
    lastProcessedAt: null,
    lastCorrelationId: null,
  },
};

const markJobsInitialized = () => {
  runtimeState.jobs.initialized = true;
  runtimeState.jobs.lastHeartbeatAt = new Date().toISOString();
};

const markJobHeartbeat = () => {
  runtimeState.jobs.lastHeartbeatAt = new Date().toISOString();
};

const markRealtimeInitialized = () => {
  runtimeState.realtime.initialized = true;
};

const setRealtimeConnectedClients = (count) => {
  runtimeState.realtime.connectedClients = count;
};

const markAIProcessed = ({ timestamp, correlationId }) => {
  runtimeState.ai.lastProcessedAt = timestamp || new Date().toISOString();
  runtimeState.ai.lastCorrelationId = correlationId || null;
};

const getRuntimeState = () => ({
  ...runtimeState,
  jobs: { ...runtimeState.jobs },
  realtime: { ...runtimeState.realtime },
  ai: { ...runtimeState.ai },
});

module.exports = {
  getRuntimeState,
  markJobsInitialized,
  markJobHeartbeat,
  markRealtimeInitialized,
  setRealtimeConnectedClients,
  markAIProcessed,
};
