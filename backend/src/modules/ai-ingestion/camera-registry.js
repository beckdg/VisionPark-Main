const cameraNodes = new Map();

const normalizeNode = (node) => ({
  cameraId: String(node.cameraId),
  branchId: node.branchId ? String(node.branchId) : null,
  zoneId: node.zoneId ? String(node.zoneId) : null,
  status: node.status || "online",
  lastSeenAt: node.lastSeenAt ? new Date(node.lastSeenAt).toISOString() : new Date().toISOString(),
});

const upsertCameraNode = ({ cameraId, branchId = null, zoneId = null, status = "online", lastSeenAt = null }) => {
  const existing = cameraNodes.get(String(cameraId)) || {};
  const merged = normalizeNode({
    ...existing,
    cameraId,
    branchId: branchId ?? existing.branchId ?? null,
    zoneId: zoneId ?? existing.zoneId ?? null,
    status: status || existing.status || "online",
    lastSeenAt: lastSeenAt || new Date().toISOString(),
  });
  cameraNodes.set(String(cameraId), merged);
  return merged;
};

const getCameraNode = (cameraId) => {
  const node = cameraNodes.get(String(cameraId));
  return node ? { ...node } : null;
};

const listCameraNodes = () => Array.from(cameraNodes.values()).map((node) => ({ ...node }));

module.exports = {
  upsertCameraNode,
  getCameraNode,
  listCameraNodes,
};
