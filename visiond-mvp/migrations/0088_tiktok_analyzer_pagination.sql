CREATE INDEX IF NOT EXISTS idx_tiktok_products_channel_seen
ON tiktok_channel_products(channel_id, last_seen_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_tiktok_product_events_channel_page
ON tiktok_product_events(channel_id, event_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_tiktok_runs_channel_page
ON tiktok_analysis_runs(channel_id, created_at DESC, id DESC);

ALTER TABLE tiktok_channel_products ADD COLUMN name_key TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_tiktok_products_channel_name_key
ON tiktok_channel_products(channel_id, name_key);
CREATE INDEX IF NOT EXISTS idx_tiktok_products_empty_name_key
ON tiktok_channel_products(name_key) WHERE name_key = '';

CREATE INDEX IF NOT EXISTS idx_products_vision4_review
ON products(source, status, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vision4_pending_status_id
ON vision4_pending_files(status, id DESC);

INSERT OR IGNORE INTO settings(key,value,updated_at)
VALUES('storefront_catalog_revision','0',CURRENT_TIMESTAMP);

CREATE TRIGGER IF NOT EXISTS trg_storefront_catalog_products_insert AFTER INSERT ON products BEGIN
  INSERT INTO settings(key,value,updated_at) VALUES('storefront_catalog_revision',lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS trg_storefront_catalog_products_update AFTER UPDATE ON products BEGIN
  INSERT INTO settings(key,value,updated_at) VALUES('storefront_catalog_revision',lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS trg_storefront_catalog_products_delete AFTER DELETE ON products BEGIN
  INSERT INTO settings(key,value,updated_at) VALUES('storefront_catalog_revision',lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS trg_storefront_catalog_categories_insert AFTER INSERT ON categories BEGIN
  INSERT INTO settings(key,value,updated_at) VALUES('storefront_catalog_revision',lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS trg_storefront_catalog_categories_update AFTER UPDATE ON categories BEGIN
  INSERT INTO settings(key,value,updated_at) VALUES('storefront_catalog_revision',lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS trg_storefront_catalog_categories_delete AFTER DELETE ON categories BEGIN
  INSERT INTO settings(key,value,updated_at) VALUES('storefront_catalog_revision',lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS trg_storefront_catalog_settings_insert AFTER INSERT ON settings
WHEN NEW.key IN ('visiond_basket_visibility','promotion_enabled','promotion_scope','promotion_scopes','promotion_percent') BEGIN
  INSERT INTO settings(key,value,updated_at) VALUES('storefront_catalog_revision',lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS trg_storefront_catalog_settings_update AFTER UPDATE ON settings
WHEN NEW.key IN ('visiond_basket_visibility','promotion_enabled','promotion_scope','promotion_scopes','promotion_percent') BEGIN
  INSERT INTO settings(key,value,updated_at) VALUES('storefront_catalog_revision',lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
END;
