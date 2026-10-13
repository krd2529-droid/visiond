CREATE TABLE IF NOT EXISTS toys_center_form_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL CHECK (store_id IN ('toys-center','zippo')),
  fields_json TEXT NOT NULL DEFAULT '{}',
  gallery_keys_json TEXT NOT NULL DEFAULT '[]',
  meta_key TEXT NOT NULL DEFAULT '',
  cover_index INTEGER NOT NULL DEFAULT 0,
  meta_zip_index INTEGER,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_toys_center_form_drafts_store_updated
  ON toys_center_form_drafts(store_id,updated_at DESC,id DESC);
