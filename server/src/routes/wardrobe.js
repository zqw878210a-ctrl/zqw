import express from "express";
import { getDb } from "../db/database.js";
import { ok, fail } from "../utils/response.js";
import { centsToYuanText } from "../utils/money.js";

const router = express.Router();

const demoWardrobeItems = [
  {
    name: "blue shirt",
    imageUrl: "/assets/items/blue-shirt.png",
    colorKey: "blue",
    priceCents: 19900,
    wearCount: 12,
    createdOffset: "-120 days",
    lastWornOffset: "-3 days"
  },
  {
    name: "burgundy knit",
    imageUrl: "/assets/items/burgundy-knit.png",
    colorKey: "burgundy",
    priceCents: 39900,
    wearCount: 4,
    createdOffset: "-140 days",
    lastWornOffset: "-35 days"
  },
  {
    name: "navy jacket",
    imageUrl: "/assets/items/navy-jacket.png",
    colorKey: "navy",
    priceCents: 89900,
    wearCount: 2,
    createdOffset: "-160 days",
    lastWornOffset: "-80 days"
  },
  {
    name: "wool coat",
    imageUrl: "/assets/items/wool-coat.png",
    colorKey: "brown",
    priceCents: 129900,
    wearCount: 0,
    createdOffset: "-120 days",
    lastWornOffset: null
  },
  {
    name: "olive sweater",
    imageUrl: "/assets/items/olive-sweater.png",
    colorKey: "olive",
    priceCents: 29900,
    wearCount: 1,
    createdOffset: "-100 days",
    lastWornOffset: "-95 days"
  }
];

function mapWardrobeItem(row) {
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
    createdAt: row.created_at,
    cpwCents: row.cpw_cents,
    cpwText: centsToYuanText(row.cpw_cents),
    idleDays: row.idle_days,
    isCheckinCooling: Boolean(row.is_checkin_cooling)
  };
}

function selectWardrobeItemById(db, itemId) {
  return db
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
        ) AS idle_days,

        CASE
          WHEN wi.last_worn_at IS NOT NULL
            AND datetime(wi.last_worn_at) > datetime('now', '-12 hours')
          THEN 1
          ELSE 0
        END AS is_checkin_cooling

      FROM wardrobe_items wi
      JOIN color_palette cp ON wi.color_key = cp.color_key
      WHERE wi.deleted_at IS NULL
        AND wi.id = ?
      `
    )
    .get(itemId);
}

router.get("/", (req, res) => {
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
          ) AS idle_days,

          CASE
            WHEN wi.last_worn_at IS NOT NULL
              AND datetime(wi.last_worn_at) > datetime('now', '-12 hours')
            THEN 1
            ELSE 0
          END AS is_checkin_cooling

        FROM wardrobe_items wi
        JOIN color_palette cp ON wi.color_key = cp.color_key
        WHERE wi.deleted_at IS NULL
        ORDER BY idle_days DESC, wi.price_cents DESC
        `
      )
      .all();

    const items = rows.map(mapWardrobeItem);

    return ok(res, {
      items,
      isEmpty: items.length === 0
    });
  } catch (error) {
    console.error("[GET /api/wardrobe]", error);
    return fail(res, 500, "DB_ERROR", "衣柜列表读取失败，请稍后再试");
  }
});

router.post("/", (req, res) => {
  try {
    const db = getDb();

    const {
      name = "未命名单品",
      imageUrl,
      colorKey,
      priceCents
    } = req.body ?? {};

    if (typeof imageUrl !== "string" || imageUrl.trim() === "") {
      return fail(res, 400, "VALIDATION_ERROR", "请先上传单品图片");
    }

    if (typeof colorKey !== "string" || colorKey.trim() === "") {
      return fail(res, 400, "VALIDATION_ERROR", "请选择单品主色");
    }

    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      return fail(res, 400, "PRICE_INVALID", "价格必须大于 0 才能计算成本哦");
    }

    const color = db
      .prepare(
        `
        SELECT color_key
        FROM color_palette
        WHERE color_key = ?
        `
      )
      .get(colorKey);

    if (!color) {
      return fail(res, 400, "VALIDATION_ERROR", "所选颜色不存在，请重新选择");
    }

    const safeName =
      typeof name === "string" && name.trim() !== ""
        ? name.trim()
        : "未命名单品";

    const result = db
      .prepare(
        `
        INSERT INTO wardrobe_items
          (name, image_url, color_key, price_cents, wear_count, last_worn_at)
        VALUES
          (?, ?, ?, ?, 0, NULL)
        `
      )
      .run(safeName, imageUrl.trim(), colorKey.trim(), priceCents);

    return ok(res, {
      id: result.lastInsertRowid,
      message: "保存成功"
    });
  } catch (error) {
    console.error("[POST /api/wardrobe]", error);
    return fail(res, 500, "DB_ERROR", "保存失败，请稍后再试");
  }
});

router.post("/demo-reset", (req, res) => {
  try {
    const db = getDb();

    const resetDemo = db.transaction(() => {
      const colorExists = db.prepare(
        `
        SELECT color_key
        FROM color_palette
        WHERE color_key = ?
        `
      );

      const missingColor = demoWardrobeItems.find(
        (item) => !colorExists.get(item.colorKey)
      );

      if (missingColor) {
        const error = new Error(`Missing color key: ${missingColor.colorKey}`);
        error.code = "DEMO_COLOR_MISSING";
        throw error;
      }

      db.prepare(
        `
        UPDATE wardrobe_items
        SET deleted_at = datetime('now')
        WHERE deleted_at IS NULL
        `
      ).run();

      const insertItem = db.prepare(
        `
        INSERT INTO wardrobe_items
          (
            name,
            image_url,
            color_key,
            price_cents,
            wear_count,
            last_worn_at,
            created_at
          )
        VALUES
          (
            ?,
            ?,
            ?,
            ?,
            ?,
            CASE
              WHEN ? IS NULL THEN NULL
              ELSE datetime('now', ?)
            END,
            datetime('now', ?)
          )
        `
      );

      const insertedIds = demoWardrobeItems.map((item) => {
        const result = insertItem.run(
          item.name,
          item.imageUrl,
          item.colorKey,
          item.priceCents,
          item.wearCount,
          item.lastWornOffset,
          item.lastWornOffset,
          item.createdOffset
        );

        return result.lastInsertRowid;
      });

      return insertedIds.map((id) => selectWardrobeItemById(db, id));
    });

    const items = resetDemo().map(mapWardrobeItem);

    return ok(res, {
      message: "演示数据已重置",
      resetCount: items.length,
      items
    });
  } catch (error) {
    console.error("[POST /api/wardrobe/demo-reset]", error);

    if (error.code === "DEMO_COLOR_MISSING") {
      return fail(res, 500, "DEMO_COLOR_MISSING", "演示数据颜色配置缺失");
    }

    return fail(res, 500, "DB_ERROR", "重置演示数据失败，请稍后再试");
  }
});

router.post("/:id/wear", (req, res) => {
  try {
    const db = getDb();
    const itemId = Number(req.params.id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return fail(res, 400, "INVALID_ITEM_ID", "单品 ID 不正确");
    }

    const item = db
      .prepare(
        `
        SELECT
          id,
          last_worn_at
        FROM wardrobe_items
        WHERE id = ?
          AND deleted_at IS NULL
        `
      )
      .get(itemId);

    if (!item) {
      return fail(res, 404, "ITEM_NOT_FOUND", "单品不存在或已删除");
    }

    const cooling = db
      .prepare(
        `
        SELECT
          CASE
            WHEN ? IS NOT NULL
              AND datetime(?) > datetime('now', '-12 hours')
            THEN 1
            ELSE 0
          END AS is_cooling
        `
      )
      .get(item.last_worn_at, item.last_worn_at);

    if (cooling.is_cooling === 1) {
      return fail(
        res,
        409,
        "CHECKIN_COOLING",
        "12 小时内已经打卡过这件单品，请稍后再试"
      );
    }

    const checkin = db.transaction(() => {
      const now = db
        .prepare(
          `
          SELECT datetime('now') AS now
          `
        )
        .get().now;

      db.prepare(
        `
        INSERT INTO wear_logs
          (item_id, worn_at, source)
        VALUES
          (?, ?, 'manual')
        `
      ).run(itemId, now);

      db.prepare(
        `
        UPDATE wardrobe_items
        SET
          wear_count = wear_count + 1,
          last_worn_at = ?
        WHERE id = ?
          AND deleted_at IS NULL
        `
      ).run(now, itemId);

      return selectWardrobeItemById(db, itemId);
    });

    const updatedItem = checkin();

    return ok(res, {
      item: mapWardrobeItem(updatedItem),
      message: "打卡成功"
    });
  } catch (error) {
    console.error("[POST /api/wardrobe/:id/wear]", error);
    return fail(res, 500, "DB_ERROR", "打卡失败，请稍后再试");
  }
});

router.delete("/:id", (req, res) => {
  try {
    const db = getDb();
    const itemId = Number(req.params.id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return fail(res, 400, "INVALID_ITEM_ID", "单品 ID 不正确");
    }

    const item = db
      .prepare(
        `
        SELECT id
        FROM wardrobe_items
        WHERE id = ?
          AND deleted_at IS NULL
        `
      )
      .get(itemId);

    if (!item) {
      return fail(res, 404, "ITEM_NOT_FOUND", "单品不存在或已删除");
    }

    db.prepare(
      `
      UPDATE wardrobe_items
      SET deleted_at = datetime('now')
      WHERE id = ?
        AND deleted_at IS NULL
      `
    ).run(itemId);

    return ok(res, {
      id: itemId,
      message: "删除成功"
    });
  } catch (error) {
    console.error("[DELETE /api/wardrobe/:id]", error);
    return fail(res, 500, "DB_ERROR", "删除失败，请稍后再试");
  }
});

router.delete("/", (req, res) => {
  try {
    const db = getDb();

    const result = db
      .prepare(
        `
        UPDATE wardrobe_items
        SET deleted_at = datetime('now')
        WHERE deleted_at IS NULL
        `
      )
      .run();

    return ok(res, {
      deletedCount: result.changes,
      message: "衣柜已清空"
    });
  } catch (error) {
    console.error("[DELETE /api/wardrobe]", error);
    return fail(res, 500, "DB_ERROR", "清空衣柜失败，请稍后再试");
  }
});

export default router;
