import "dotenv/config";
import express from "express";
import cors from "cors";
import PostRouter from "./routes/postRoute.js";
import UserRouter from "./routes/userRoute.js";
import CoupleRouter from "./routes/coupleRoute.js";
import GroupRouter from "./routes/groupRoute.js";
import { errorHandler, notFound } from "./middleWares/errorHandler.js";
import { generalLimiter } from "./middleWares/rateLimit.js";
import {
  corsDebug,
  corsOptions,
  securityHeaders,
} from "./middleWares/security.js";

const app = express();
const apiVersion = "cors-middleware-2026-04-21";

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.use(securityHeaders);
app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Silent Connection API",
    status: "ok",
    version: apiVersion,
    health: "/api/health",
  });
});
app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok", version: apiVersion });
});
app.get("/api/debug/runtime", (req, res) => {
  res.json({
    success: true,
    version: apiVersion,
    nodeEnv: process.env.NODE_ENV || null,
    hasMongoUri: Boolean(process.env.MONGO_URI),
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    jwtSecretLength: process.env.JWT_SECRET?.length || 0,
    hasSmtpConfig: Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM,
    ),
  });
});
app.get("/api/cors-debug", corsDebug);
app.use("/api", generalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use("/api/posts", PostRouter);
app.use("/api/users", UserRouter);
app.use("/api/couples", CoupleRouter);
app.use("/api/groups", GroupRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
