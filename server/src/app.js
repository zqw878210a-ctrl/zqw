import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { initDatabase } from "./db/database.js";
import authRouter from "./routes/auth.js";
import colorsRouter from "./routes/colors.js";
import wardrobeRouter from "./routes/wardrobe.js";
import diagnosisRouter from "./routes/diagnosis.js";
import resaleCopyRouter from "./routes/resaleCopy.js";
import { fail } from "./utils/response.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const CORS_ORIGIN = process.env.CORS_ORIGIN?.trim();
const JWT_SECRET = process.env.JWT_SECRET?.trim();

initDatabase();

if (!JWT_SECRET) {
  console.warn("[Auth] JWT_SECRET is not set. Using local fallback; set JWT_SECRET on Render before production demos.");
}

app.use(cors(CORS_ORIGIN ? { origin: CORS_ORIGIN } : undefined));
app.use(express.json({ limit: "2mb" }));

const assetsPath = path.resolve(__dirname, "../../assets");
app.use("/assets", express.static(assetsPath));

app.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      service: "wardrobe-mvp-server"
    }
  });
});

app.use("/api/auth", authRouter);
app.use("/api/colors", colorsRouter);
app.use("/api/wardrobe", wardrobeRouter);
app.use("/api/diagnosis", diagnosisRouter);
app.use("/api/resale-copy", resaleCopyRouter);

app.use((req, res) => {
  return fail(res, 404, "NOT_FOUND", "接口不存在");
});

app.use((err, req, res, next) => {
  console.error("[Unhandled Error]", err);
  return fail(res, 500, "SERVER_ERROR", "服务器异常，请稍后再试");
});

app.listen(PORT, HOST, () => {
  console.log(`[Server] running at http://${HOST}:${PORT}`);
});
