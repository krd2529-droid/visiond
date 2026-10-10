CREATE TABLE vpage_compensation_requests (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  days INTEGER NOT NULL CHECK(days BETWEEN 1 AND 365),
  idempotency_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK(state IN ('held','committed','released')),
  before_expires_at TEXT NOT NULL,
  after_expires_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_vpage_compensation_page_live ON vpage_compensation_requests(page_id) WHERE state='held';
CREATE INDEX idx_vpage_compensation_actor ON vpage_compensation_requests(actor_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_vpage_pages_domain_cursor ON vpage_pages(domain_id,status,id DESC);
