import express from "express";
import PostRouter from "./routes/postRoute.js";
import UserRouter from "./routes/userRoute.js";
import CoupleRouter from "./routes/coupleRoute.js";
import GroupRouter from "./routes/groupRoute.js";
import { errorHandler, notFound } from "./middleWares/errorHandler.js";
import { generalLimiter } from "./middleWares/rateLimit.js";
import { cors, securityHeaders } from "./middleWares/security.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(cors);
app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Silent Connection API",
    status: "ok",
    health: "/api/health",
  });
});
app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});
app.use("/api", generalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use("/api/posts", PostRouter);
app.use("/api/users", UserRouter);
app.use("/api/couples", CoupleRouter);
app.use("/api/groups", GroupRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
