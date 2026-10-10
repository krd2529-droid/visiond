-- Owner media can exist before a paid page exists. No credit or page is created here.
CREATE TABLE vpage_owner_assets (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  object_key TEXT NOT NULL UNIQUE,
  source_hash TEXT NOT NULL CHECK(length(source_hash)=64),
  content_hash TEXT NOT NULL CHECK(length(content_hash)=64),
  mime_type TEXT NOT NULL CHECK(mime_type='image/webp'),
  file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 5242880),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 4096),
  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 4096),
  idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','ready','deleting','deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id,idempotency_key)
);
CREATE INDEX idx_vpage_owner_assets_list ON vpage_owner_assets(owner_id,state,id DESC);
CREATE TRIGGER vpage_owner_assets_limit BEFORE INSERT ON vpage_owner_assets
WHEN (SELECT COUNT(*) FROM vpage_owner_assets WHERE owner_id=NEW.owner_id AND state IN ('pending','ready'))>=48
BEGIN SELECT RAISE(ABORT,'vpage owner asset limit'); END;
