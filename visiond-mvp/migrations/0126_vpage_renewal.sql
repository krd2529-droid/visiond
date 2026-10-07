CREATE TABLE vpage_renewal_requests (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE RESTRICT,
  credit_id INTEGER NOT NULL REFERENCES vpage_credits(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('held','remote_committed','committed','released')),
  remote_status TEXT,
  remote_expires_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,idempotency_key)
);

CREATE UNIQUE INDEX idx_vpage_renewals_credit_live
ON vpage_renewal_requests(credit_id)
WHERE state IN ('held','remote_committed');

CREATE UNIQUE INDEX idx_vpage_renewals_page_live
ON vpage_renewal_requests(page_id)
WHERE state IN ('held','remote_committed');

CREATE INDEX idx_vpage_renewals_owner_page
ON vpage_renewal_requests(user_id,page_id,state,id DESC);
