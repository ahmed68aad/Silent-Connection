const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
  "https://silent-connection-64up.vercel.app",
  "http://localhost:5173",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "token", "X-Session-Id"],
  credentials: true,
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

const corsDebug = (req, res) => {
  res.json({
    success: true,
    requestOrigin: req.get("origin") || null,
    allowedOrigins,
    methods: corsOptions.methods,
    allowedHeaders: corsOptions.allowedHeaders,
    credentials: corsOptions.credentials,
  });
};

export { corsDebug, corsOptions, securityHeaders };
