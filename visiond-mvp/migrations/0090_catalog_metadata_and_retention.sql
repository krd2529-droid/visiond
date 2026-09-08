-- v0.20.62: persisted storefront classification plus main-DB maintenance leases.
-- This migration is schema/index/state only. 0091 performs the bounded replay-safe backfill.
ALTER TABLE products ADD COLUMN storefront_group TEXT;
ALTER TABLE products ADD COLUMN storefront_sort_rank INTEGER;
ALTER TABLE products ADD COLUMN storefront_meta_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS storefront_catalog_metadata_state (
  id INTEGER PRIMARY KEY CHECK(id=1),
  version INTEGER NOT NULL DEFAULT 1,
  ready INTEGER NOT NULL DEFAULT 0 CHECK(ready IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO storefront_catalog_metadata_state(id,version,ready) VALUES(1,1,0);

CREATE TABLE IF NOT EXISTS maintenance_job_leases (
  job_key TEXT PRIMARY KEY,
  lease_token TEXT NOT NULL DEFAULT '',
  lease_expires_at TEXT,
  last_completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_storefront_catalog_products_update;
CREATE TRIGGER trg_storefront_catalog_products_update
AFTER UPDATE OF slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,product_kind,deleted_at ON products
BEGIN
  INSERT INTO settings(key,value,updated_at) VALUES('storefront_catalog_revision',lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS trg_storefront_meta_product_insert
AFTER INSERT ON products
BEGIN
  UPDATE products SET
    storefront_group=CASE
      WHEN lower(COALESCE(category,'')) LIKE '%tattoo%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%tattoo%' OR title LIKE '%รอยสัก%' OR title LIKE '%แบบสัก%' THEN 'tattoo'
      WHEN lower(COALESCE(category,'')) LIKE '%coloring%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%coloring%' OR title LIKE '%ระบายสี%' THEN 'coloring'
      WHEN lower(COALESCE(category,'')) LIKE '%development-game%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%development-game%' OR title LIKE '%เกมเสริมพัฒนาการ%' OR lower(title) LIKE '%maze%' OR title LIKE '%เขาวงกต%' THEN 'development-game'
      WHEN lower(COALESCE(category,'')) LIKE '%paper-doll%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%paper-doll%' OR title LIKE '%ตุ๊กตากระดาษ%' THEN 'paper-doll'
      WHEN category='resale-rights' OR slug='course-selling-rights' THEN 'resale-rights'
      ELSE 'worksheet' END,
    storefront_sort_rank=CASE WHEN lower(COALESCE(category,'')) LIKE '%tattoo%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%tattoo%' OR title LIKE '%รอยสัก%' OR title LIKE '%แบบสัก%' THEN 1 ELSE 0 END,
    storefront_meta_version=1
  WHERE id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_storefront_meta_product_update
AFTER UPDATE OF slug,title,category ON products
BEGIN
  UPDATE products SET
    storefront_group=CASE
      WHEN lower(COALESCE(category,'')) LIKE '%tattoo%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%tattoo%' OR title LIKE '%รอยสัก%' OR title LIKE '%แบบสัก%' THEN 'tattoo'
      WHEN lower(COALESCE(category,'')) LIKE '%coloring%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%coloring%' OR title LIKE '%ระบายสี%' THEN 'coloring'
      WHEN lower(COALESCE(category,'')) LIKE '%development-game%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%development-game%' OR title LIKE '%เกมเสริมพัฒนาการ%' OR lower(title) LIKE '%maze%' OR title LIKE '%เขาวงกต%' THEN 'development-game'
      WHEN lower(COALESCE(category,'')) LIKE '%paper-doll%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%paper-doll%' OR title LIKE '%ตุ๊กตากระดาษ%' THEN 'paper-doll'
      WHEN category='resale-rights' OR slug='course-selling-rights' THEN 'resale-rights'
      ELSE 'worksheet' END,
    storefront_sort_rank=CASE WHEN lower(COALESCE(category,'')) LIKE '%tattoo%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%tattoo%' OR title LIKE '%รอยสัก%' OR title LIKE '%แบบสัก%' THEN 1 ELSE 0 END,
    storefront_meta_version=1
  WHERE id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_storefront_meta_backfill
AFTER UPDATE OF storefront_meta_version ON products
WHEN NEW.storefront_meta_version<>1
BEGIN
  UPDATE products SET
    storefront_group=CASE
      WHEN lower(COALESCE(category,'')) LIKE '%tattoo%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%tattoo%' OR title LIKE '%รอยสัก%' OR title LIKE '%แบบสัก%' THEN 'tattoo'
      WHEN lower(COALESCE(category,'')) LIKE '%coloring%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%coloring%' OR title LIKE '%ระบายสี%' THEN 'coloring'
      WHEN lower(COALESCE(category,'')) LIKE '%development-game%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%development-game%' OR title LIKE '%เกมเสริมพัฒนาการ%' OR lower(title) LIKE '%maze%' OR title LIKE '%เขาวงกต%' THEN 'development-game'
      WHEN lower(COALESCE(category,'')) LIKE '%paper-doll%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%paper-doll%' OR title LIKE '%ตุ๊กตากระดาษ%' THEN 'paper-doll'
      WHEN category='resale-rights' OR slug='course-selling-rights' THEN 'resale-rights'
      ELSE 'worksheet' END,
    storefront_sort_rank=CASE WHEN lower(COALESCE(category,'')) LIKE '%tattoo%' OR lower(COALESCE((SELECT parent_slug FROM categories WHERE slug=products.category),'')) LIKE '%tattoo%' OR title LIKE '%รอยสัก%' OR title LIKE '%แบบสัก%' THEN 1 ELSE 0 END,
    storefront_meta_version=1
  WHERE id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_storefront_meta_category_insert
AFTER INSERT ON categories
BEGIN
  UPDATE products SET storefront_meta_version=0 WHERE category=NEW.slug;
END;
CREATE TRIGGER IF NOT EXISTS trg_storefront_meta_category_parent_update
AFTER UPDATE OF slug,parent_slug ON categories
BEGIN
  UPDATE products SET storefront_meta_version=0 WHERE category IN (OLD.slug,NEW.slug);
END;
CREATE TRIGGER IF NOT EXISTS trg_storefront_meta_category_delete
AFTER DELETE ON categories
BEGIN
  UPDATE products SET storefront_meta_version=0 WHERE category=OLD.slug;
END;

CREATE INDEX IF NOT EXISTS idx_products_storefront_default
ON products(storefront_sort_rank,id DESC)
WHERE storefront_meta_version=1 AND status='published' AND deleted_at IS NULL
  AND COALESCE(product_kind,'product')='product'
  AND (category<>'resale-rights' OR slug='course-selling-rights');
CREATE INDEX IF NOT EXISTS idx_products_storefront_group
ON products(storefront_group,storefront_sort_rank,id DESC)
WHERE storefront_meta_version=1 AND status='published' AND deleted_at IS NULL
  AND COALESCE(product_kind,'product')='product'
  AND (category<>'resale-rights' OR slug='course-selling-rights');
CREATE INDEX IF NOT EXISTS idx_products_storefront_pending
ON products(id) WHERE storefront_meta_version<>1;
CREATE INDEX IF NOT EXISTS idx_products_public_slug_nocase
ON products(slug COLLATE NOCASE)
WHERE status='published' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_pending_retention
ON page_views(id) WHERE aggregated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_expired_retention
ON page_views(viewed_at,id) WHERE aggregated_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_events_retention
ON customer_events(created_at,id);
CREATE INDEX IF NOT EXISTS idx_trash_items_expiry
ON trash_items(expires_at,id);
CREATE INDEX IF NOT EXISTS idx_products_deleted_retention
ON products(deleted_at,id) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_product_retention
ON order_items(product_id,order_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_product_active_retention
ON entitlements(product_id,active);

INSERT INTO runtime_schema_state(schema_key,version,updated_at) VALUES('storefront_catalog',90,CURRENT_TIMESTAMP)
ON CONFLICT(schema_key) DO UPDATE SET version=excluded.version,updated_at=CURRENT_TIMESTAMP;
