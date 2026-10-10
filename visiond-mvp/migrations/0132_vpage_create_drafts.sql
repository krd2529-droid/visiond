-- One private, revisioned pre-create draft per owner. This never creates a page or claims credit.
CREATE TABLE vpage_create_drafts (
  owner_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  draft_json TEXT NOT NULL CHECK(length(draft_json) BETWEEN 2 AND 65536),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE vpage_create_draft_refs (
  owner_id INTEGER NOT NULL REFERENCES vpage_create_drafts(owner_id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES vpage_owner_assets(id) ON DELETE RESTRICT,
  PRIMARY KEY(owner_id,media_id)
);
CREATE INDEX idx_vpage_create_draft_refs_media ON vpage_create_draft_refs(media_id);
CREATE TABLE vpage_draft_transition_guards(token TEXT PRIMARY KEY NOT NULL);
CREATE TRIGGER vpage_create_draft_ref_ready BEFORE INSERT ON vpage_create_draft_refs
WHEN NOT EXISTS(SELECT 1 FROM vpage_owner_assets WHERE id=NEW.media_id AND owner_id=NEW.owner_id AND state='ready')
BEGIN SELECT RAISE(ABORT,'vpage draft media not ready'); END;
CREATE TRIGGER vpage_owner_asset_draft_guard BEFORE UPDATE OF state ON vpage_owner_assets
WHEN NEW.state IN ('deleting','deleted') AND EXISTS(SELECT 1 FROM vpage_create_draft_refs WHERE media_id=NEW.id)
BEGIN SELECT RAISE(ABORT,'vpage media in draft'); END;
