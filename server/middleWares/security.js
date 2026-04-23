const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://silent-connection-fgt3.vercel.app",
  "https://silent-connection-fgt3-ahmadabdelhamid99-8196s-projects.vercel.app",
];

const parseAllowedOrigins = () => {
  const configuredOrigins =
    process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || process.env.CORS_ORIGIN;

  if (!configuredOrigins) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  const configuredAllowedOrigins = configuredOrigins
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredAllowedOrigins])];
};

const getAllowedOrigins = () => parseAllowedOrigins();
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "");

const isVercelOrigin = (origin) => {
  try {
    return new URL(origin).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  const allowedOrigins = parseAllowedOrigins();

  return (
    allowedOrigins.includes(normalizedOrigin) ||
    (process.env.ALLOW_VERCEL_ORIGINS === "true" && isVercelOrigin(normalizedOrigin))
  );
};

const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
};

const cors = (req, res, next) => {
  const origin = req.get("origin");
  const allowedOrigin = isAllowedOrigin(origin) ? normalizeOrigin(origin) : "*";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
};

const corsDebug = (req, res) => {
  const origin = req.get("origin") || req.query.origin || "";

  res.json({
    success: true,
    requestOrigin: origin || null,
    allowed: isAllowedOrigin(origin),
    allowedOrigins: parseAllowedOrigins(),
    allowVercelOrigins: process.env.ALLOW_VERCEL_ORIGINS === "true",
  });
};

export { cors, corsDebug, getAllowedOrigins, securityHeaders };
