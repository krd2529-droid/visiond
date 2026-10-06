CREATE TABLE vpage_domains (
  id TEXT PRIMARY KEY,
  slot INTEGER NOT NULL UNIQUE CHECK(slot BETWEEN 1 AND 10),
  hostname TEXT NOT NULL UNIQUE CHECK(hostname=lower(hostname)),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vpage_pages (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES vpage_domains(id) ON DELETE RESTRICT,
  owner_ref TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','suspended','deleted')),
  create_idempotency_key TEXT NOT NULL UNIQUE,
  create_request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(length(slug) BETWEEN 3 AND 50),
  CHECK(length(display_name) BETWEEN 1 AND 120),
  UNIQUE(domain_id,slug)
);

CREATE TABLE vpage_api_nonces (
  key_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(key_id,nonce)
);

CREATE TABLE vpage_lifecycle_requests (
  idempotency_key TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE RESTRICT,
  owner_ref TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('suspend','resume','renew','delete')),
  request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vpage_domains_enabled_slot ON vpage_domains(enabled,slot);
CREATE INDEX idx_vpage_pages_public_route ON vpage_pages(domain_id,slug,status,expires_at);
CREATE INDEX idx_vpage_pages_owner_cursor ON vpage_pages(owner_ref,created_at DESC,id DESC);
CREATE INDEX idx_vpage_nonces_expiry ON vpage_api_nonces(expires_at);

INSERT INTO vpage_domains(id,slot,hostname,enabled)
VALUES('dom_smartlinkpage',1,'smartlinkpage.com',1);
