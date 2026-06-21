import express from "express";
import { getDb } from "../db/database.js";
import { ok, fail } from "../utils/response.js";
import { centsToYuanText } from "../utils/money.js";

const router = express.Router();

function getConditionText(wearCount) {
  if (wearCount === 0) {
    return "几乎全新";
  }

  if (wearCount <= 3) {
    return "轻微使用";
  }

  if (wearCount <= 10) {
    return "正常使用";
  }

  return "使用痕迹较明显";
}

function getResaleRate(wearCount, idleDays) {
  let rate = 0.7;

  if (wearCount === 0) {
    rate = 0.75;
  } else if (wearCount <= 3) {
    rate = 0.65;
  } else if (wearCount <= 10) {
    rate = 0.5;
  } else {
    rate = 0.35;
  }

  if (idleDays >= 90) {
    rate -= 0.1;
  }

  if (rate < 0.3) {
    rate = 0.3;
  }

  return rate;
}

function roundToYuanCents(cents) {
  return Math.round(cents / 100) * 100;
}

function buildResaleCopy(item) {
  const conditionText = getConditionText(item.wear_count);
  const resaleRate = getResaleRate(item.wear_count, item.idle_days);
  const suggestedPriceCents = roundToYuanCents(item.price_cents * resaleRate);

  const title = `${item.color_name}${item.name}｜${conditionText}｜建议转卖价 ${centsToYuanText(suggestedPriceCents)}`;

  const priceProof = [
    `原购入价：${centsToYuanText(item.price_cents)}`,
    `累计穿着次数：${item.wear_count} 次`,
    `当前单次穿着成本 CPW：${centsToYuanText(item.cpw_cents)}`,
    `当前闲置天数：${item.idle_days} 天`,
    `系统建议转卖价：${centsToYuanText(suggestedPriceCents)}`
  ];

  const description = [
    `这是一件${item.color_name}单品，名称为「${item.name}」。`,
    `原购入价为 ${centsToYuanText(item.price_cents)}，目前累计穿着 ${item.wear_count} 次，当前 CPW 为 ${centsToYuanText(item.cpw_cents)}。`,
    `根据穿着次数、闲置天数和购入价格综合估算，建议转卖价为 ${centsToYuanText(suggestedPriceCents)}。`,
    `适合希望以更低成本入手基础单品的买家。`
  ].join("\n");

  const sellerNote = [
    "建议发布前补充真实照片、尺码、品牌、面料、瑕疵情况。",
    "如果有明显污渍、起球、变形，请在文案中如实说明。",
    "当前价格只是系统估算，实际成交价可以根据平台同类商品再微调。"
  ];

  return {
    item: {
      id: item.id,
      name: item.name,
      imageUrl: item.image_url,
      colorKey: item.color_key,
      colorName: item.color_name,
      hex: item.hex,

      priceCents: item.price_cents,
      priceText: centsToYuanText(item.price_cents),

      wearCount: item.wear_count,
      lastWornAt: item.last_worn_at,

      cpwCents: item.cpw_cents,
      cpwText: centsToYuanText(item.cpw_cents),

      idleDays: item.idle_days
    },

    resale: {
      title,
      description,
      conditionText,
      suggestedPriceCents,
      suggestedPriceText: centsToYuanText(suggestedPriceCents),
      resaleRate,
      priceProof,
      sellerNote
    }
  };
}

router.post("/", (req, res) => {
  try {
    const db = getDb();
    const { itemId } = req.body ?? {};

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return fail(res, 400, "INVALID_ITEM_ID", "请传入正确的单品 ID");
    }

    const item = db
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
          AND wi.id = ?
        `
      )
      .get(itemId);

    if (!item) {
      return fail(res, 404, "ITEM_NOT_FOUND", "单品不存在或已删除");
    }

    return ok(res, buildResaleCopy(item));
  } catch (error) {
    console.error("[POST /api/resale-copy]", error);
    return fail(res, 500, "DB_ERROR", "转卖文案生成失败，请稍后再试");
  }
});

export default router;