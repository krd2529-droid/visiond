CREATE TABLE IF NOT EXISTS veasy_runtime_leases (
  shop_id TEXT PRIMARY KEY,
  app_session_id TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  lease_token_hash TEXT NOT NULL UNIQUE,
  acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  heartbeat_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE,
  FOREIGN KEY(app_session_id) REFERENCES vision7_app_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_veasy_runtime_expiry ON veasy_runtime_leases(expires_at);

CREATE TABLE IF NOT EXISTS veasy_conversation_leases (
  shop_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  runtime_lease_hash TEXT NOT NULL,
  lease_token_hash TEXT NOT NULL UNIQUE,
  acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  heartbeat_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  PRIMARY KEY(shop_id,conversation_id),
  FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_veasy_conversation_expiry ON veasy_conversation_leases(expires_at);

CREATE TABLE IF NOT EXISTS veasy_message_claims (
  shop_id TEXT NOT NULL,
  platform_message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  PRIMARY KEY(shop_id,platform_message_id),
  FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS veasy_order_claims (
  shop_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  order_ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'processing',
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  PRIMARY KEY(shop_id,idempotency_key),
  FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE
);
