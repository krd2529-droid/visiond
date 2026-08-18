CREATE TABLE IF NOT EXISTS veasy_shops (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  license_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  meta_page_id TEXT NOT NULL UNIQUE,
  meta_page_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(license_id) REFERENCES vision7_licenses(id) ON DELETE RESTRICT,
  CHECK(status IN ('active','suspended','disconnected'))
);
CREATE INDEX IF NOT EXISTS idx_veasy_shop_owner ON veasy_shops(user_id,status,updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_veasy_shop_owner_chain ON veasy_shops(id,user_id,license_id,meta_page_id);
