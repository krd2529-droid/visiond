ALTER TABLE toys_center_products ADD COLUMN store_id TEXT NOT NULL DEFAULT 'toys-center' CHECK (store_id IN ('toys-center','zippo'));
CREATE INDEX IF NOT EXISTS idx_stock_store_updated ON toys_center_products(store_id,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_stock_store_status_updated ON toys_center_products(store_id,status,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_stock_store_status_id ON toys_center_products(store_id,status,id);
CREATE INDEX IF NOT EXISTS idx_stock_store_title ON toys_center_products(store_id,title COLLATE NOCASE,id);
CREATE INDEX IF NOT EXISTS idx_stock_store_meta_id ON toys_center_products(store_id,meta_id COLLATE NOCASE,id);
CREATE TABLE IF NOT EXISTS stock_store_settings (
  store_id TEXT PRIMARY KEY CHECK (store_id IN ('toys-center','zippo')),
  storefront_mode TEXT NOT NULL DEFAULT 'unlisted' CHECK (storefront_mode IN ('public','unlisted')),
  page_id TEXT NOT NULL DEFAULT '',
  page_name TEXT NOT NULL DEFAULT '',
  catalog_id TEXT NOT NULL DEFAULT '',
  catalog_name TEXT NOT NULL DEFAULT '',
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO stock_store_settings(store_id,storefront_mode,page_name,catalog_name)
SELECT 'toys-center',storefront_mode,'Toys Center','Toys Center' FROM toys_center_settings WHERE id=1;
INSERT OR IGNORE INTO stock_store_settings(store_id,storefront_mode,page_id,page_name,catalog_id,catalog_name)
VALUES('zippo','unlisted','1208831352314389','Zippo Udonthani','1018833961115899','Zippo');
