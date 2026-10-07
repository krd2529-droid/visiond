ALTER TABLE vpage_pages ADD COLUMN media_active_set INTEGER CHECK(media_active_set IN (1,2));
ALTER TABLE vpage_pages ADD COLUMN media_active_state TEXT NOT NULL DEFAULT 'unknown' CHECK(media_active_state IN ('unknown','pending','synced'));

CREATE TABLE vpage_media (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE RESTRICT,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
  file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 5242880),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 4096),
  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 4096),
  content_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','ready','deleting','deleted')),
  lease_token TEXT NOT NULL DEFAULT '',
  lease_expires_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id,idempotency_key)
);

CREATE INDEX idx_vpage_media_owner_page
ON vpage_media(owner_id,page_id,state,id DESC);

CREATE INDEX idx_vpage_media_page_state
ON vpage_media(page_id,state,id);

CREATE INDEX idx_vpage_media_cleanup
ON vpage_media(owner_id,page_id,state,updated_at DESC,id DESC);

CREATE TABLE vpage_media_save_ops (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE RESTRICT,
  vpage_id TEXT NOT NULL,
  set_no INTEGER NOT NULL CHECK(set_no IN (1,2)),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','committed','failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id,idempotency_key)
);

CREATE UNIQUE INDEX idx_vpage_media_save_live
ON vpage_media_save_ops(page_id,set_no)
WHERE state='pending';

CREATE INDEX idx_vpage_media_save_page
ON vpage_media_save_ops(page_id,set_no,state,created_at DESC);

CREATE TABLE vpage_media_pending_refs (
  op_id TEXT NOT NULL REFERENCES vpage_media_save_ops(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES vpage_media(id) ON DELETE RESTRICT,
  slot_key TEXT NOT NULL,
  PRIMARY KEY(op_id,slot_key)
);

CREATE INDEX idx_vpage_media_pending_media
ON vpage_media_pending_refs(media_id,op_id);

CREATE TABLE vpage_media_refs (
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE RESTRICT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  set_no INTEGER NOT NULL CHECK(set_no IN (1,2)),
  slot_key TEXT NOT NULL,
  media_id TEXT NOT NULL REFERENCES vpage_media(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(page_id,set_no,slot_key)
);

CREATE INDEX idx_vpage_media_refs_media
ON vpage_media_refs(media_id,page_id,set_no);

CREATE INDEX idx_vpage_media_refs_page_set
ON vpage_media_refs(page_id,set_no,slot_key,media_id);
