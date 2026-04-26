const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
]
  .filter(Boolean)
  .map((origin) => origin.trim().toLowerCase().replace(/\/$/, ""));

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = origin.trim().toLowerCase().replace(/\/$/, "");

  if (allowedOrigins.includes(normalizedOrigin)) return true;

  try {
    const { hostname } = new URL(normalizedOrigin);

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return true;
    }

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
