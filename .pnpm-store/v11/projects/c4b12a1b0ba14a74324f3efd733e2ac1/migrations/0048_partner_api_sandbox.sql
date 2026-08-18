CREATE TABLE IF NOT EXISTS partner_sandbox_runs (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL,
  scenario TEXT NOT NULL CHECK(scenario IN ('customer','order','payment','cancellation','refund')),
  external_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_summary TEXT NOT NULL,
  replayed INTEGER NOT NULL DEFAULT 0 CHECK(replayed IN (0,1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id,idempotency_key),
  FOREIGN KEY(website_id) REFERENCES partner_websites(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_partner_sandbox_runs_site ON partner_sandbox_runs(website_id,created_at DESC);
