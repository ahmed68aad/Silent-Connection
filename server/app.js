import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import PostRouter from "./routes/postRoute.js";
import UserRouter from "./routes/userRoute.js";
import CoupleRouter from "./routes/coupleRoute.js";
import GroupRouter from "./routes/groupRoute.js";
import { errorHandler, notFound } from "./middleWares/errorHandler.js";
import { generalLimiter } from "./middleWares/rateLimit.js";
import { corsOptions, securityHeaders } from "./middleWares/security.js";
import { uploadsRoot } from "./config/multer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.disable("x-powered-by");

// ✅ CORS لازم يبقى أول حاجة
app.use(cors(corsOptions));

// ✅ حل مشكلة preflight (OPTIONS)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// ✅ security + body parser
app.use(securityHeaders);
app.use(express.json({ limit: "1mb" }));

// ✅ static files
app.use("/uploads", express.static(uploadsRoot));

// ✅ health routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Silent Connection API",
    status: "ok",
    health: "/api/health",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    database: mongoose.connection.name || null,
  });
});

// ✅ rate limiter
app.use("/api", generalLimiter);

// ✅ routes
app.use("/api/posts", PostRouter);
app.use("/api/users", UserRouter);
app.use("/api/couples", CoupleRouter);
app.use("/api/groups", GroupRouter);

// ✅ production frontend
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.resolve(__dirname, "../client/dist");

  app.use(express.static(clientBuildPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

// ✅ errors
app.use(notFound);
app.use(errorHandler);

export default app;
