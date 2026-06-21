PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS color_palette (
  color_key TEXT PRIMARY KEY,
  color_name TEXT NOT NULL,
  hex TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL UNIQUE,

  CHECK (length(hex) = 7 AND substr(hex, 1, 1) = '#')
);

CREATE TABLE IF NOT EXISTS wardrobe_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  name TEXT NOT NULL DEFAULT '未命名单品',
  image_url TEXT NOT NULL,

  color_key TEXT NOT NULL,
  price_cents INTEGER NOT NULL,

  wear_count INTEGER NOT NULL DEFAULT 0,
  last_worn_at TEXT DEFAULT NULL,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT DEFAULT NULL,

  FOREIGN KEY (color_key) REFERENCES color_palette(color_key),

  CHECK (price_cents > 0),
  CHECK (wear_count >= 0)
);

CREATE TABLE IF NOT EXISTS wear_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  item_id INTEGER NOT NULL,
  worn_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL DEFAULT 'manual',

  client_request_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (item_id) REFERENCES wardrobe_items(id) ON DELETE CASCADE,

  CHECK (source IN ('manual', 'seed', 'repair'))
);

CREATE TABLE IF NOT EXISTS preset_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  name TEXT NOT NULL UNIQUE,
  image_url TEXT NOT NULL,

  color_key TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,

  source_label TEXT NOT NULL DEFAULT '本地预埋',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (color_key) REFERENCES color_palette(color_key),

  CHECK (price_cents >= 0),
  CHECK (is_active IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_wardrobe_color
ON wardrobe_items(color_key);

CREATE INDEX IF NOT EXISTS idx_wardrobe_price
ON wardrobe_items(price_cents);

CREATE INDEX IF NOT EXISTS idx_wardrobe_last_worn
ON wardrobe_items(last_worn_at);

CREATE INDEX IF NOT EXISTS idx_wear_logs_item_time
ON wear_logs(item_id, worn_at);

CREATE INDEX IF NOT EXISTS idx_preset_color_active
ON preset_products(color_key, is_active);

CREATE TRIGGER IF NOT EXISTS trg_wardrobe_items_updated_at
AFTER UPDATE ON wardrobe_items
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE wardrobe_items
  SET updated_at = datetime('now')
  WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_preset_products_updated_at
AFTER UPDATE ON preset_products
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE preset_products
  SET updated_at = datetime('now')
  WHERE id = OLD.id;
END;