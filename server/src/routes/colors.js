import express from "express";
import { getDb } from "../db/database.js";
import { ok, fail } from "../utils/response.js";

const router = express.Router();

router.get("/", (req, res) => {
  try {
    const db = getDb();

    const colors = db
      .prepare(
        `
        SELECT
          color_key AS colorKey,
          color_name AS colorName,
          hex,
          sort_order AS sortOrder
        FROM color_palette
        ORDER BY sort_order ASC
        `
      )
      .all();

    return ok(res, colors);
  } catch (error) {
    console.error("[GET /api/colors]", error);
    return fail(res, 500, "DB_ERROR", "色盘读取失败，请稍后再试");
  }
});

export default router;