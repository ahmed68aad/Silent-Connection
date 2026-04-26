const stores = new Map();

const getClientKey = (req) => {
  const forwardedFor = req.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || req.ip || req.socket.remoteAddress || "unknown";
};

const rateLimit = ({ windowMs, max, message }) => {
  const hits = new Map();
  stores.set(Symbol(message), hits);

  return (req, res, next) => {
    // Skip rate limiting for preflight requests
    if (req.method === "OPTIONS") {
      return next();
    }

    const now = Date.now();
    const key = getClientKey(req);
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > max) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    return next();
  };
};

const cleanupRateLimitStores = () => {
  const now = Date.now();

  for (const hits of stores.values()) {
    for (const [key, value] of hits.entries()) {
      if (value.resetAt <= now) {
        hits.delete(key);
      }
    }
  }
};

setInterval(cleanupRateLimitStores, 10 * 60 * 1000).unref();

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many requests. Please try again soon.",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: "Too many authentication attempts. Please wait and try again.",
});

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many verification requests. Please wait before trying again.",
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  message: "Too many uploads. Please try again later.",
});

export { authLimiter, emailLimiter, generalLimiter, uploadLimiter };
