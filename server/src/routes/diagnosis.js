import express from "express";
import { getDb } from "../db/database.js";
import { ok, fail } from "../utils/response.js";
import { centsToYuanText } from "../utils/money.js";

const router = express.Router();

const IDLE_THRESHOLD_DAYS = 90;
const HIGH_CPW_THRESHOLD_CENTS = 10000;

function buildDiagnosis(row) {
  const tags = [];
  const reasons = [];
  let level = "normal";
  let nextAction = "keep";
  let suggestion = "这件单品目前状态正常，可以继续保留在衣柜中。";

  if (row.wear_count === 0) {
    tags.push("未穿过");
    reasons.push("这件单品还没有任何穿着记录，当前 CPW 等于购入价。");
    level = "warning";
    nextAction = "wear";
    suggestion = "建议优先安排一次穿搭，让它从“闲置资产”变成“已使用资产”。";
  }

  if (row.cpw_cents >= HIGH_CPW_THRESHOLD_CENTS) {
    tags.push("CPW 偏高");
    reasons.push(`当前单次穿着成本为 ${centsToYuanText(row.cpw_cents)}，成本利用率还不够理想。`);
    level = "warning";
    nextAction = "wear";
    suggestion = "建议近期多穿 1-2 次，降低单次穿着成本。";
  }

  if (row.idle_days >= IDLE_THRESHOLD_DAYS) {
    tags.push("闲置超 90 天");
    reasons.push(`这件单品已经闲置 ${row.idle_days} 天，超过了 90 天闲置阈值。`);
    level = "danger";
    nextAction = "resale_or_rewear";
    suggestion = "建议先尝试重新搭配一次；如果仍然不想穿，可以进入转卖文案流程。";
  }

  if (tags.length === 0) {
    tags.push("状态正常");
    reasons.push("这件单品没有明显闲置或高 CPW 风险。");
  }

  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url,
    colorKey: row.color_key,
    colorName: row.color_name,
    hex: row.hex,

    priceCents: row.price_cents,
    priceText: centsToYuanText(row.price_cents),

    wearCount: row.wear_count,
    lastWornAt: row.last_worn_at,

    cpwCents: row.cpw_cents,
    cpwText: centsToYuanText(row.cpw_cents),

    idleDays: row.idle_days,

    level,
    tags,
    reasons,
    suggestion,
    nextAction
  };
}

router.post("/", (req, res) => {
  try {
    const db = getDb();

    const rows = db
      .prepare(
        `
        SELECT
          wi.id,
          wi.name,
          wi.image_url,
          wi.color_key,
          wi.price_cents,
          wi.wear_count,
          wi.last_worn_at,
          wi.created_at,

          cp.color_name,
          cp.hex,

          CASE
            WHEN wi.wear_count > 0 THEN ROUND(wi.price_cents * 1.0 / wi.wear_count)
            ELSE wi.price_cents
          END AS cpw_cents,

          CAST(
            julianday('now') - julianday(COALESCE(wi.last_worn_at, wi.created_at))
            AS INTEGER
          ) AS idle_days

        FROM wardrobe_items wi
        JOIN color_palette cp ON wi.color_key = cp.color_key
        WHERE wi.deleted_at IS NULL
        ORDER BY idle_days DESC, wi.price_cents DESC
        `
      )
      .all();

    const items = rows.map(buildDiagnosis);

    const summary = {
      totalItems: items.length,
      zeroWearCount: items.filter((item) => item.wearCount === 0).length,
      highCpwCount: items.filter((item) => item.cpwCents >= HIGH_CPW_THRESHOLD_CENTS).length,
      idleOver90Count: items.filter((item) => item.idleDays >= IDLE_THRESHOLD_DAYS).length,
      resaleCandidateCount: items.filter((item) => item.nextAction === "resale_or_rewear").length
    };

    return ok(res, {
      summary,
      items,
      isEmpty: items.length === 0,
      rules: {
        idleThresholdDays: IDLE_THRESHOLD_DAYS,
        highCpwThresholdText: centsToYuanText(HIGH_CPW_THRESHOLD_CENTS)
      }
    });
  } catch (error) {
    console.error("[POST /api/diagnosis]", error);
    return fail(res, 500, "DB_ERROR", "诊断失败，请稍后再试");
  }
});

export default router;