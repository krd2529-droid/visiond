CREATE TABLE IF NOT EXISTS partner_websites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','revoked')),
  scopes TEXT NOT NULL DEFAULT '["products:read"]',
  client_id TEXT NOT NULL UNIQUE,
  secret_ciphertext TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  secret_last4 TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_partner_websites_status ON partner_websites(status,updated_at DESC);
CREATE TABLE IF NOT EXISTS partner_api_audit (
  id TEXT PRIMARY KEY,
  website_id TEXT,
  request_id TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  required_scope TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(website_id) REFERENCES partner_websites(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_partner_api_audit_website ON partner_api_audit(website_id,created_at DESC);
