const { randomUUID } = require("crypto");

const requestContext = (req, res, next) => {
  const requestId = req.headers["x-request-id"] || randomUUID();
  const userId = req.headers["x-user-id"] || null;

  req.context = {
    requestId,
    userId,
    startedAt: new Date(),
  };

  res.setHeader("x-request-id", requestId);
  return next();
};

module.exports = {
  requestContext,
};
