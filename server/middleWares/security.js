const parseOrigins = (val) => {
  if (!val) return [];
  return String(val)
    .replace(/['"\s]/g, "")
    .split(",")
    .map((origin) => origin.trim().toLowerCase().replace(/\/$/, ""))
    .filter(Boolean);
};

const getAllowedOrigins = () => {
  const origins = new Set();

  // Add from environment variables
  [process.env.CLIENT_ORIGIN, process.env.CLIENT_URL, process.env.CORS_ORIGIN]
    .flatMap(parseOrigins)
    .forEach((o) => origins.add(o));

  // Standard development origins
  origins.add("http://localhost:5173");
  origins.add("http://127.0.0.1:5173");
  origins.add("http://localhost:5174");

  return origins;
};

const isAllowedOrigin = (origin) => {
  const rawOrigin = String(origin || "").trim();

  // Allow server-to-server or tools like Postman (no origin)
  if (!rawOrigin || rawOrigin === "null") return true;

  const normalizedOrigin = rawOrigin.toLowerCase().replace(/\/$/, "");

  if (
    normalizedOrigin === "http://localhost" ||
    normalizedOrigin.startsWith("http://localhost:") ||
    normalizedOrigin === "http://127.0.0.1" ||
    normalizedOrigin.startsWith("http://127.0.0.1:") ||
    normalizedOrigin.startsWith("http://[::1]:")
  ) {
    return true;
  }

  const allowed = getAllowedOrigins();
  if (allowed.has(normalizedOrigin)) {
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

    console.warn(`[CORS REJECTED] Origin: "${origin}"`);

    // On Vercel, always return false if not matched to maintain security
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
  optionsSuccessStatus: 200, // Some browsers prefer 200 over 204
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
