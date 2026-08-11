CREATE TABLE IF NOT EXISTS veasy_channel_credentials (
  shop_id TEXT NOT NULL REFERENCES veasy_shops(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('line')),
  external_account_id TEXT NOT NULL DEFAULT '',
  secret_ciphertext TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(shop_id,provider)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_line_event_dedupe ON veasy_webhook_events(endpoint_id,external_event_id) WHERE external_event_id!='';
