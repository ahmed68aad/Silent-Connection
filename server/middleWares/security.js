const parseOrigins = (val) => {
  if (!val) return [];
  return String(val)
    .replace(/['"]/g, "")
    .split(",")
    .map((origin) => origin.trim().toLowerCase().replace(/\/$/, ""))
    .filter(Boolean);
};

const getAllowedOrigins = () => {
  return new Set([
    ...parseOrigins(process.env.CLIENT_ORIGIN),
    ...parseOrigins(process.env.CLIENT_URL),
    ...parseOrigins(process.env.CORS_ORIGIN),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
  ]);
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = origin.trim().toLowerCase().replace(/\/$/, "");
  if (normalizedOrigin === "null") return true;

  const allowed = getAllowedOrigins();
  if (
    allowed.has(normalizedOrigin) ||
    normalizedOrigin.startsWith("http://localhost:") ||
    normalizedOrigin.startsWith("http://127.0.0.1:") ||
    normalizedOrigin.startsWith("http://[::1]:")
  ) {
    return true;
  }

  try {
    const { hostname } = new URL(normalizedOrigin);
    return (
      hostname.endsWith(".vercel.app") ||
      hostname.endsWith(".vercel.dev") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV === "production") {
      console.warn(`[CORS REJECTED] Origin: "${origin}"`);
    }
    // Return the origin anyway in dev to stop blocking, or false in prod
    return callback(null, process.env.NODE_ENV !== "production");
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
  optionsSuccessStatus: 200,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
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
