ALTER TABLE vsport_image_candidates ADD COLUMN ingest_fence TEXT;
ALTER TABLE vsport_image_candidates ADD COLUMN ingest_lease_expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_vsport_candidates_project_ingest
  ON vsport_image_candidates(project_id, state, ingest_lease_expires_at, id);

-- Deletion receipts intentionally have no foreign key to vsport_projects. They
-- are the owner-scoped replay record after the project graph has cascaded away.
CREATE TABLE IF NOT EXISTS vsport_project_deletions (
  owner_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  project_title TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK(LENGTH(request_hash) = 64),
  cleanup_state TEXT NOT NULL DEFAULT 'pending'
    CHECK(cleanup_state IN ('pending','complete')),
  deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cleanup_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(owner_id, project_id),
  UNIQUE(owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_vsport_project_deletions_owner_project
  ON vsport_project_deletions(owner_id, project_id);

-- This exact-key ledger also acts as the pre-put orphan guard. It intentionally
-- survives project deletion and never supports prefix/catalog cleanup.
CREATE TABLE IF NOT EXISTS vsport_object_cleanup_jobs (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL CHECK(reason IN ('orphan_guard','deleted')),
  status TEXT NOT NULL CHECK(status IN ('reserved','pending','error','done')),
  writer_fence TEXT,
  lease_expires_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at TEXT,
  last_error_code TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vsport_cleanup_owner_project
  ON vsport_object_cleanup_jobs(owner_id, project_id, status, id);
CREATE INDEX IF NOT EXISTS idx_vsport_cleanup_state_due
  ON vsport_object_cleanup_jobs(status, next_attempt_at, id)
  WHERE status IN ('pending','error');
