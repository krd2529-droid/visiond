CREATE TABLE IF NOT EXISTS veasy_webhook_endpoints (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES veasy_shops(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('line','facebook','easyslip','generic')),
  public_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','revoked')),
  adapter_state TEXT NOT NULL DEFAULT 'pending' CHECK(adapter_state IN ('pending','ready','error')),
  received_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  last_event_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_shop_provider_live ON veasy_webhook_endpoints(shop_id,provider) WHERE status!='revoked';
CREATE INDEX IF NOT EXISTS idx_webhook_endpoint_shop ON veasy_webhook_endpoints(shop_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS veasy_webhook_events (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES veasy_webhook_endpoints(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL UNIQUE,
  external_event_id TEXT NOT NULL DEFAULT '',
  signature_status TEXT NOT NULL DEFAULT 'pending' CHECK(signature_status IN ('pending','valid','invalid','not_required')),
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK(processing_status IN ('received','rejected','processed','failed')),
  event_type TEXT NOT NULL DEFAULT '',
  error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_endpoint ON veasy_webhook_events(endpoint_id,created_at DESC);
