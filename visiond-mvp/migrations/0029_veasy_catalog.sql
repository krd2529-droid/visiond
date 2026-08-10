ALTER TABLE veasy_shops ADD COLUMN plan_limit INTEGER NOT NULL DEFAULT 20;

CREATE TABLE IF NOT EXISTS veasy_categories (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE,
  UNIQUE(shop_id, slug)
);

CREATE TABLE IF NOT EXISTS veasy_products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  sku TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  specifications TEXT NOT NULL DEFAULT '',
  warranty TEXT NOT NULL DEFAULT '',
  shipping_detail TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK(price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE,
  FOREIGN KEY(category_id) REFERENCES veasy_categories(id) ON DELETE RESTRICT,
  UNIQUE(shop_id, sku),
  UNIQUE(shop_id, slug),
  UNIQUE(shop_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_veasy_products_shop ON veasy_products(shop_id,status,created_at DESC);
