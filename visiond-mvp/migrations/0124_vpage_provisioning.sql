CREATE TABLE vpage_pages (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  credit_id INTEGER REFERENCES vpage_credits(id) ON DELETE RESTRICT,
  vpage_id TEXT UNIQUE,
  domain_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('provisioning','repair_required','active','suspended','deleted','failed')),
  create_idempotency_key TEXT NOT NULL,
  create_request_hash TEXT NOT NULL,
  public_url TEXT,
  remote_created_at TEXT,
  expires_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(length(slug) BETWEEN 3 AND 50),
  CHECK(length(display_name) BETWEEN 1 AND 120),
  UNIQUE(user_id,create_idempotency_key)
);

CREATE TABLE vpage_credit_claims (
  id TEXT PRIMARY KEY,
  credit_id INTEGER NOT NULL REFERENCES vpage_credits(id) ON DELETE RESTRICT,
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK(state IN ('held','committed','released')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vpage_transition_guards (
  token TEXT PRIMARY KEY NOT NULL
);

CREATE UNIQUE INDEX idx_vpage_pages_domain_slug_live
ON vpage_pages(domain_id,slug)
WHERE status IN ('provisioning','repair_required','active','suspended');

CREATE INDEX idx_vpage_pages_owner_cursor
ON vpage_pages(user_id,id DESC);

CREATE INDEX idx_vpage_pages_owner_status
ON vpage_pages(user_id,status,id DESC);

CREATE UNIQUE INDEX idx_vpage_claims_credit_live
ON vpage_credit_claims(credit_id)
WHERE state IN ('held','committed');

CREATE UNIQUE INDEX idx_vpage_claims_page_live
ON vpage_credit_claims(page_id)
WHERE state IN ('held','committed');
