const { TooManyRequestsError } = require("../../common/errors");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 20;

const buckets = new Map();

const pruneBuckets = (now) => {
  for (const [key, entry] of buckets.entries()) {
    if (now - entry.windowStart > WINDOW_MS) {
      buckets.delete(key);
    }
  }
};

const authOtpRateLimit = (req, res, next) => {
  const now = Date.now();
  pruneBuckets(now);

  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";

  const key = `${ip}:${req.path}`;
  let entry = buckets.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    buckets.set(key, entry);
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    return next(
      new TooManyRequestsError("Too many requests from this IP. Please try again later.")
    );
  }
  return next();
};

module.exports = {
  authOtpRateLimit,
};
