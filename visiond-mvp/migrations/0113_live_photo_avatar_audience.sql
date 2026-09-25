CREATE TABLE IF NOT EXISTS live_presenter_assets (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK(mime_type = 'image/jpeg'),
  file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 5242880),
  width INTEGER NOT NULL CHECK(width BETWEEN 256 AND 4096),
  height INTEGER NOT NULL CHECK(height BETWEEN 256 AND 4096),
  sha256 TEXT NOT NULL CHECK(LENGTH(sha256) = 64),
  portrait_version INTEGER NOT NULL CHECK(portrait_version > 0),
  sanitizer_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','active','replaced','deleted')),
  consent_policy TEXT NOT NULL,
  consent_attested_by INTEGER NOT NULL,
  consent_attested_at TEXT NOT NULL,
  create_idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK(LENGTH(request_hash) = 64),
  uploaded_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by INTEGER,
  delete_idempotency_key TEXT,
  delete_request_hash TEXT,
  FOREIGN KEY(show_id) REFERENCES live_shows(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_id) REFERENCES users(id),
  FOREIGN KEY(consent_attested_by) REFERENCES users(id),
  FOREIGN KEY(uploaded_by) REFERENCES users(id),
  FOREIGN KEY(deleted_by) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_presenter_active_show_owner
  ON live_presenter_assets(show_id, owner_id, status)
  WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_presenter_upload_idempotency
  ON live_presenter_assets(show_id, uploaded_by, create_idempotency_key);
CREATE INDEX IF NOT EXISTS idx_live_presenter_show_owner_created
  ON live_presenter_assets(show_id, owner_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_presenter_show_owner_version
  ON live_presenter_assets(show_id, owner_id, portrait_version);

CREATE TABLE IF NOT EXISTS live_presenter_bindings (
  show_id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  presenter_asset_id TEXT UNIQUE,
  portrait_version INTEGER NOT NULL DEFAULT 0 CHECK(portrait_version >= 0),
  binding_revision INTEGER NOT NULL DEFAULT 0 CHECK(binding_revision >= 0),
  updated_by INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(show_id) REFERENCES live_shows(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_id) REFERENCES users(id),
  FOREIGN KEY(presenter_asset_id) REFERENCES live_presenter_assets(id) ON DELETE SET NULL,
  FOREIGN KEY(updated_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_live_presenter_binding_owner_show
  ON live_presenter_bindings(owner_id, show_id, binding_revision);

-- A small claim row deduplicates the expensive sanitizer and R2 write before an
-- asset exists. Same-key callers observe processing/completed state instead of
-- paying for a second Cloudflare Images transform.
CREATE TABLE IF NOT EXISTS live_portrait_upload_claims (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  uploaded_by INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK(LENGTH(request_hash) = 64),
  status TEXT NOT NULL CHECK(status IN ('processing','completed','error')),
  lease_token TEXT,
  lease_expires_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 1 CHECK(attempts BETWEEN 1 AND 8),
  result_asset_id TEXT,
  last_error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(show_id) REFERENCES live_shows(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_id) REFERENCES users(id),
  FOREIGN KEY(uploaded_by) REFERENCES users(id),
  FOREIGN KEY(result_asset_id) REFERENCES live_presenter_assets(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_portrait_upload_claim_key
  ON live_portrait_upload_claims(show_id, uploaded_by, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_live_portrait_upload_claim_retry
  ON live_portrait_upload_claims(owner_id, show_id, status, lease_expires_at, attempts, id)
  WHERE status IN ('processing','error');
CREATE INDEX IF NOT EXISTS idx_live_portrait_upload_claim_retention
  ON live_portrait_upload_claims(owner_id, show_id, status, expires_at, id);

CREATE TABLE IF NOT EXISTS live_portrait_object_cleanup_jobs (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  show_id TEXT NOT NULL,
  presenter_asset_id TEXT,
  object_key TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL CHECK(reason IN ('orphan_guard','replaced','deleted')),
  status TEXT NOT NULL CHECK(status IN ('reserved','pending','error','done')),
  idempotency_key TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
  next_attempt_at TEXT,
  last_error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(owner_id) REFERENCES users(id),
  FOREIGN KEY(show_id) REFERENCES live_shows(id) ON DELETE RESTRICT,
  FOREIGN KEY(presenter_asset_id) REFERENCES live_presenter_assets(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_live_portrait_cleanup_due
  ON live_portrait_object_cleanup_jobs(owner_id, show_id, status, next_attempt_at, id)
  WHERE status IN ('reserved','pending','error');

CREATE TABLE IF NOT EXISTS live_runtime_sessions (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  presenter_asset_id TEXT,
  presenter_sha256 TEXT,
  mode TEXT NOT NULL CHECK(mode IN ('avatar','local_test','facebook')),
  provider_adapter TEXT NOT NULL CHECK(provider_adapter IN ('d-id','local-test','facebook')),
  provider_session_resource_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('starting','active','stopped','error','expired')),
  session_epoch INTEGER NOT NULL DEFAULT 1 CHECK(session_epoch > 0),
  create_idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK(LENGTH(request_hash) = 64),
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  stopped_at TEXT,
  stop_idempotency_key TEXT,
  stop_request_hash TEXT,
  FOREIGN KEY(show_id) REFERENCES live_shows(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_id) REFERENCES users(id),
  FOREIGN KEY(presenter_asset_id) REFERENCES live_presenter_assets(id) ON DELETE RESTRICT,
  FOREIGN KEY(provider_session_resource_id) REFERENCES live_provider_resources(id) ON DELETE SET NULL,
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_runtime_active_owner_show_mode
  ON live_runtime_sessions(owner_id, show_id, mode)
  WHERE status IN ('starting','active');
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_runtime_create_idempotency
  ON live_runtime_sessions(owner_id, show_id, created_by, create_idempotency_key);
CREATE INDEX IF NOT EXISTS idx_live_runtime_owner_show_status_cursor
  ON live_runtime_sessions(owner_id, show_id, status, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_live_runtime_expiry
  ON live_runtime_sessions(status, expires_at, id);
CREATE INDEX IF NOT EXISTS idx_live_runtime_owner_show_expiry
  ON live_runtime_sessions(owner_id, show_id, expires_at, id);

-- Every D-ID identifier remains encrypted at rest. Each successful remote create
-- is checkpointed before the next step so partial failures and portrait revoke
-- can resume targeted, idempotent cleanup without exposing or scanning IDs.
CREATE TABLE IF NOT EXISTS live_provider_resources (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider = 'd-id'),
  resource_kind TEXT NOT NULL CHECK(resource_kind IN ('image','avatar','agent','stream')),
  owner_id INTEGER NOT NULL,
  show_id TEXT NOT NULL,
  presenter_asset_id TEXT NOT NULL,
  runtime_session_id TEXT,
  parent_resource_id TEXT,
  provider_ref_ciphertext TEXT NOT NULL,
  provider_ref_hash TEXT NOT NULL CHECK(LENGTH(provider_ref_hash) = 64),
  status TEXT NOT NULL CHECK(status IN ('creating','active','delete_pending','deleted','error')),
  create_idempotency_key TEXT NOT NULL,
  create_request_hash TEXT NOT NULL CHECK(LENGTH(create_request_hash) = 64),
  cleanup_idempotency_key TEXT,
  cleanup_attempts INTEGER NOT NULL DEFAULT 0 CHECK(cleanup_attempts BETWEEN 0 AND 8),
  next_cleanup_at TEXT,
  last_error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(owner_id) REFERENCES users(id),
  FOREIGN KEY(show_id) REFERENCES live_shows(id) ON DELETE CASCADE,
  FOREIGN KEY(presenter_asset_id) REFERENCES live_presenter_assets(id) ON DELETE RESTRICT,
  FOREIGN KEY(runtime_session_id) REFERENCES live_runtime_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY(parent_resource_id) REFERENCES live_provider_resources(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_provider_resource_ref
  ON live_provider_resources(provider, resource_kind, provider_ref_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_provider_resource_create_idempotency
  ON live_provider_resources(owner_id, show_id, create_idempotency_key, resource_kind);
CREATE INDEX IF NOT EXISTS idx_live_provider_asset_cleanup
  ON live_provider_resources(owner_id, show_id, presenter_asset_id, status, resource_kind, id);
CREATE INDEX IF NOT EXISTS idx_live_provider_cleanup_due
  ON live_provider_resources(status, next_cleanup_at, cleanup_attempts, id)
  WHERE status IN ('delete_pending','error');
CREATE INDEX IF NOT EXISTS idx_live_provider_session_resources
  ON live_provider_resources(runtime_session_id, status, resource_kind, id);

CREATE TABLE IF NOT EXISTS live_audience_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  show_id TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('local_test','facebook')),
  external_event_hash TEXT NOT NULL CHECK(LENGTH(external_event_hash) = 64),
  kind TEXT NOT NULL CHECK(kind IN ('viewer_join','comment')),
  viewer_ref_hash TEXT NOT NULL CHECK(LENGTH(viewer_ref_hash) = 64),
  viewer_label TEXT NOT NULL DEFAULT '',
  question_text TEXT NOT NULL DEFAULT '',
  product_id INTEGER NOT NULL,
  priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 100),
  answer_kind TEXT NOT NULL CHECK(answer_kind IN ('greeting','grounded','unknown')),
  answer_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ready','claimed','consumed','discarded')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 2),
  claim_token TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  FOREIGN KEY(session_id) REFERENCES live_runtime_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(show_id) REFERENCES live_shows(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_id) REFERENCES users(id),
  FOREIGN KEY(product_id) REFERENCES toys_center_products(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_audience_event_dedupe
  ON live_audience_events(session_id, source, external_event_hash);
CREATE INDEX IF NOT EXISTS idx_live_audience_ready_queue
  ON live_audience_events(session_id, status, priority DESC, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_live_audience_claim_expiry
  ON live_audience_events(session_id, status, claimed_at, id);
CREATE INDEX IF NOT EXISTS idx_live_audience_session_retention
  ON live_audience_events(session_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_live_audience_owner_show_cursor
  ON live_audience_events(owner_id, show_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_live_audience_expiry
  ON live_audience_events(status, expires_at, id);
CREATE INDEX IF NOT EXISTS idx_live_audience_owner_show_expiry
  ON live_audience_events(owner_id, show_id, expires_at, id);

CREATE TRIGGER IF NOT EXISTS trg_live_audience_capacity_before_insert
BEFORE INSERT ON live_audience_events
WHEN NEW.status = 'ready'
  AND (SELECT COUNT(*) FROM live_audience_events WHERE session_id = NEW.session_id AND status IN ('ready','claimed')) >= 24
  AND (
    NOT EXISTS(SELECT 1 FROM live_audience_events WHERE session_id = NEW.session_id AND status = 'ready')
    OR NEW.priority <= COALESCE((SELECT MIN(priority) FROM live_audience_events WHERE session_id = NEW.session_id AND status = 'ready'), 100)
  )
BEGIN
  SELECT RAISE(ABORT, 'LIVE_AUDIENCE_CAPACITY');
END;

CREATE TRIGGER IF NOT EXISTS trg_live_audience_capacity_after_insert
AFTER INSERT ON live_audience_events
WHEN NEW.status = 'ready'
  AND (SELECT COUNT(*) FROM live_audience_events WHERE session_id = NEW.session_id AND status IN ('ready','claimed')) > 24
BEGIN
  UPDATE live_audience_events
  SET status = 'discarded', viewer_ref_hash = '0000000000000000000000000000000000000000000000000000000000000000',
      viewer_label = '', question_text = '', answer_text = '', updated_at = NEW.created_at
  WHERE id = (
    SELECT id FROM live_audience_events
    WHERE session_id = NEW.session_id AND status = 'ready'
    ORDER BY priority ASC, created_at DESC, id DESC
    LIMIT 1
  );
END;
