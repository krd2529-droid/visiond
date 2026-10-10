-- Objects are private until a committed active content set refers to them.
CREATE TABLE IF NOT EXISTS vpage_media (
  id TEXT PRIMARY KEY CHECK(id GLOB 'vpm_*'),
  owner_ref TEXT NOT NULL CHECK(length(owner_ref)=64),
  object_key TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL CHECK(length(content_hash)=64),
  mime_type TEXT NOT NULL CHECK(mime_type='image/webp'),
  file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 5242880),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 4096),
  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 4096),
  state TEXT NOT NULL CHECK(state IN ('pending','ready','deleting','deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vpage_media_owner ON vpage_media(owner_ref,state,id DESC);
CREATE TABLE IF NOT EXISTS vpage_media_refs (
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE CASCADE,
  set_no INTEGER NOT NULL CHECK(set_no IN (1,2)),
  slot_key TEXT NOT NULL,
  media_id TEXT NOT NULL REFERENCES vpage_media(id) ON DELETE RESTRICT,
  PRIMARY KEY(page_id,set_no,slot_key)
);
CREATE INDEX IF NOT EXISTS idx_vpage_media_refs_media ON vpage_media_refs(media_id,page_id,set_no);
CREATE TRIGGER IF NOT EXISTS vpage_media_ref_ready BEFORE INSERT ON vpage_media_refs
WHEN NOT EXISTS(SELECT 1 FROM vpage_media WHERE id=NEW.media_id AND state='ready')
BEGIN SELECT RAISE(ABORT,'vpage media not ready'); END;
CREATE TRIGGER IF NOT EXISTS vpage_media_delete_unreferenced BEFORE UPDATE OF state ON vpage_media
WHEN NEW.state IN ('deleting','deleted') AND EXISTS(SELECT 1 FROM vpage_media_refs WHERE media_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'vpage media in use'); END;
