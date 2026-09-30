-- A saved-image deletion must remain replayable after its asset row is gone.
-- Receipts and exact-object cleanup jobs deliberately survive project deletion.
CREATE TABLE IF NOT EXISTS vsport_asset_deletions (
  owner_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  asset_id INTEGER NOT NULL,
  candidate_id INTEGER,
  object_key TEXT NOT NULL,
  cleanup_job_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK(LENGTH(request_hash) = 64),
  deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(owner_id, asset_id),
  UNIQUE(owner_id, idempotency_key),
  UNIQUE(object_key)
);

CREATE INDEX IF NOT EXISTS idx_vsport_asset_deletions_owner_project
  ON vsport_asset_deletions(owner_id, project_id, asset_id);
