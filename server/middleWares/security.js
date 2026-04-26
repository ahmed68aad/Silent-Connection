const parseOrigins = (val) => {
  if (!val) return [];
  // Handle comma-separated strings from environment variables
  return String(val)
    .split(",")
    .map((origin) => origin.trim().toLowerCase().replace(/\/$/, ""))
    .filter(Boolean);
};

const allowedOrigins = new Set([
  ...parseOrigins(process.env.CLIENT_ORIGIN),
  ...parseOrigins(process.env.CLIENT_URL),
  ...parseOrigins(process.env.CORS_ORIGIN),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = origin.trim().toLowerCase().replace(/\/$/, "");

  if (allowedOrigins.has(normalizedOrigin)) return true;

  // Additional check for localhost/127.0.0.1 with any port
  if (
    normalizedOrigin.startsWith("http://localhost:") ||
    normalizedOrigin.startsWith("http://127.0.0.1:")
  ) {
    return true;
  }

  try {
    const { hostname } = new URL(normalizedOrigin);
    if (hostname.endsWith(".vercel.app") || hostname.endsWith(".vercel.dev")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked for origin: ${origin}`);
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Session-Id",
    "Accept",
    "Origin",
    "token",
    "X-Requested-With",
    "Access-Control-Request-Headers",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 86400, // 24 hours
};

const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  next();
};

export { corsOptions, securityHeaders };
