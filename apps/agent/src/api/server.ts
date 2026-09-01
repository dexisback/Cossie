import express from "express";
import cors from "cors";
import { approvalRouter } from "./approval.routes.js";
import { chatRouter } from "./chat.routes.js";
import { healthRouter } from "../health/health.route.js";
import { logRouter } from "./log.routes.js";
import { securityRouter } from "./security.routes.js";
import { toolRouter } from "./tool.routes.js";
import { ruleRouter } from "./rule.routes.js";
import { riskRouter } from "./risk.routes.js";

export function createServer() {
  const app = express();

  const allowedOrigins = (
    process.env.CORS_ORIGIN ??
    "https://cossie.amaanworks.me,http://localhost:3000"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cors({ origin: allowedOrigins }));

  app.use(
    express.json()
  );

 app.use("/api", chatRouter);

app.use("/api", healthRouter);
app.use("/api", approvalRouter);
app.use("/api", logRouter);
app.use("/api", toolRouter);
app.use("/api", ruleRouter);
app.use("/api", riskRouter);
app.use("/api", securityRouter);
  return app;
}