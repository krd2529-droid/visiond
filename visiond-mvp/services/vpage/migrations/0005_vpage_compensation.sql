CREATE TABLE IF NOT EXISTS vpage_compensation_requests (
  idempotency_key TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE RESTRICT,
  owner_ref TEXT NOT NULL,
  actor_ref TEXT NOT NULL,
  days INTEGER NOT NULL CHECK(days BETWEEN 1 AND 365),
  before_expires_at TEXT NOT NULL,
  after_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vpage_compensation_page ON vpage_compensation_requests(page_id,created_at DESC);
CREATE TABLE IF NOT EXISTS vpage_compensation_guards (token TEXT PRIMARY KEY NOT NULL);
