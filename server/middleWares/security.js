const parseOrigins = (val) => {
  if (!val) return [];
  return String(val)
    .replace(/['"\s]/g, "") // Remove quotes and spaces
    .split(",")
    .map((origin) => origin.trim().toLowerCase().replace(/\/$/, ""))
    .filter(Boolean);
};

const getAllowedOrigins = () => {
  const envOrigins = [
    process.env.CLIENT_ORIGIN,
    process.env.CLIENT_URL,
    process.env.CORS_ORIGIN,
  ].flatMap((val) => parseOrigins(val));

  return new Set([
    ...envOrigins,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
  ]);
};

const isAllowedOrigin = (origin) => {
  // Handle cases with no origin (mobile apps, Postman) or null origin string
  const rawOrigin = String(origin || "").trim();
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
    const isAllowed = isAllowedOrigin(origin);
    if (isAllowed) {
      return callback(null, true);
    }

    // This log appears in Vercel Dashboard -> Logs
    console.warn(
      `[CORS REJECTED] Origin: "${origin}" | Host: ${origin ? new URL(origin).hostname : "none"}`,
    );

    // Allow in non-production environments anyway
    const shouldAllow = process.env.NODE_ENV !== "production";
    return callback(null, shouldAllow);
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
