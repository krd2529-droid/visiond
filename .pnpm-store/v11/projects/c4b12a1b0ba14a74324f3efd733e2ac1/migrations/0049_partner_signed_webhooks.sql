CREATE TABLE IF NOT EXISTS partner_webhook_events (
  id TEXT PRIMARY KEY, website_id TEXT NOT NULL, event_type TEXT NOT NULL,
  external_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, signature_hash TEXT NOT NULL, request_hash TEXT NOT NULL,
  payload_ciphertext TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','retry','dead')),
  attempts INTEGER NOT NULL DEFAULT 0, response_status INTEGER NOT NULL DEFAULT 0,
  error_code TEXT NOT NULL DEFAULT '', next_retry_at TEXT, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id,idempotency_key), UNIQUE(website_id,signature_hash),
  FOREIGN KEY(website_id) REFERENCES partner_websites(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_webhook_queue ON partner_webhook_events(website_id,status,next_retry_at,updated_at DESC);
CREATE TABLE IF NOT EXISTS partner_webhook_logs (
  id TEXT PRIMARY KEY, website_id TEXT NOT NULL, event_id TEXT, level TEXT NOT NULL,
  event_type TEXT NOT NULL, external_id_masked TEXT NOT NULL, message TEXT NOT NULL,
  response_status INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(website_id) REFERENCES partner_websites(id) ON DELETE CASCADE,
  FOREIGN KEY(event_id) REFERENCES partner_webhook_events(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_partner_webhook_logs_site ON partner_webhook_logs(website_id,created_at DESC);
