CREATE TABLE IF NOT EXISTS live_shows (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  avatar_preset TEXT NOT NULL DEFAULT 'visiond-default',
  output_profile TEXT NOT NULL DEFAULT 'landscape-1080p',
  scene_count INTEGER NOT NULL DEFAULT 0 CHECK(scene_count BETWEEN 0 AND 24),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  create_idempotency_key TEXT NOT NULL,
  create_request_hash TEXT NOT NULL,
  last_mutation_key TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  updated_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(updated_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_live_shows_updated
  ON live_shows(updated_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_shows_create_idempotency
  ON live_shows(created_by, create_idempotency_key);

CREATE TABLE IF NOT EXISTS live_show_scenes (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 23),
  product_id INTEGER NOT NULL,
  product_meta_id_snapshot TEXT NOT NULL,
  product_title_snapshot TEXT NOT NULL,
  product_price_snapshot INTEGER NOT NULL CHECK(product_price_snapshot >= 0),
  product_currency_snapshot TEXT NOT NULL,
  product_stock_snapshot INTEGER NOT NULL CHECK(product_stock_snapshot >= 0),
  product_cover_image_id_snapshot INTEGER NOT NULL,
  product_cover_position_snapshot INTEGER NOT NULL CHECK(product_cover_position_snapshot BETWEEN 0 AND 9),
  product_cover_key_snapshot TEXT NOT NULL,
  product_cover_mime_snapshot TEXT NOT NULL CHECK(product_cover_mime_snapshot IN ('image/jpeg','image/png','image/webp')),
  product_cover_size_snapshot INTEGER NOT NULL CHECK(product_cover_size_snapshot BETWEEN 1 AND 5242880),
  product_cover_etag_snapshot TEXT NOT NULL,
  script TEXT NOT NULL DEFAULT '',
  cue_label TEXT NOT NULL DEFAULT '',
  cue_duration_seconds INTEGER NOT NULL DEFAULT 60 CHECK(cue_duration_seconds BETWEEN 5 AND 3600),
  cue_transition TEXT NOT NULL DEFAULT 'cut' CHECK(cue_transition IN ('cut','fade')),
  FOREIGN KEY(show_id) REFERENCES live_shows(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_scenes_show_position
  ON live_show_scenes(show_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_scenes_show_product
  ON live_show_scenes(show_id, product_id);

CREATE TABLE IF NOT EXISTS live_show_versions (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK(version_number > 0),
  show_revision INTEGER NOT NULL CHECK(show_revision > 0),
  schema_version INTEGER NOT NULL CHECK(schema_version = 1),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  package_object_key TEXT NOT NULL UNIQUE,
  package_sha256 TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL,
  package_size INTEGER NOT NULL CHECK(package_size > 0),
  asset_count INTEGER NOT NULL CHECK(asset_count BETWEEN 1 AND 24),
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(show_id) REFERENCES live_shows(id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_versions_show_number
  ON live_show_versions(show_id, version_number DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_versions_show_idempotency
  ON live_show_versions(show_id, idempotency_key);

CREATE TABLE IF NOT EXISTS live_show_version_assets (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  scene_position INTEGER NOT NULL CHECK(scene_position BETWEEN 0 AND 23),
  product_id_snapshot INTEGER NOT NULL,
  source_image_id INTEGER NOT NULL,
  source_position INTEGER NOT NULL CHECK(source_position BETWEEN 0 AND 9),
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK(file_size > 0),
  sha256 TEXT NOT NULL,
  etag TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(show_id) REFERENCES live_shows(id) ON DELETE RESTRICT,
  FOREIGN KEY(version_id) REFERENCES live_show_versions(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_version_assets_scene
  ON live_show_version_assets(version_id, scene_position);

CREATE TRIGGER IF NOT EXISTS trg_live_versions_immutable_update
BEFORE UPDATE ON live_show_versions
BEGIN
  SELECT RAISE(ABORT, 'LIVE_VERSION_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_live_versions_immutable_delete
BEFORE DELETE ON live_show_versions
BEGIN
  SELECT RAISE(ABORT, 'LIVE_VERSION_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_live_version_assets_immutable_update
BEFORE UPDATE ON live_show_version_assets
BEGIN
  SELECT RAISE(ABORT, 'LIVE_VERSION_ASSET_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_live_version_assets_immutable_delete
BEFORE DELETE ON live_show_version_assets
BEGIN
  SELECT RAISE(ABORT, 'LIVE_VERSION_ASSET_IMMUTABLE');
END;

CREATE INDEX IF NOT EXISTS idx_toys_center_live_inventory
  ON toys_center_products(updated_at DESC, id DESC)
  WHERE status='published' AND availability='in stock' AND quantity>0;
CREATE INDEX IF NOT EXISTS idx_toys_center_live_title
  ON toys_center_products(title COLLATE NOCASE ASC, id ASC)
  WHERE status='published' AND availability='in stock' AND quantity>0;
CREATE INDEX IF NOT EXISTS idx_toys_center_product_images_product_position
  ON toys_center_product_images(product_id, position);
CREATE INDEX IF NOT EXISTS idx_toys_center_product_images_product_key_position
  ON toys_center_product_images(product_id, image_key, position);
