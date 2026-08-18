-- v0.14.31: secure password recovery and bounded analytics retention.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  consume_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user
  ON password_reset_tokens(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_expiry
  ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  product_id INTEGER,
  visitor_key TEXT NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aggregated_at TEXT,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Existing deployments receive aggregated_at through ensureDatabase's
-- guarded PRAGMA/ALTER compatibility path before these indexes are used.

CREATE TABLE IF NOT EXISTS analytics_daily (
  day_local TEXT NOT NULL,
  path TEXT NOT NULL,
  product_id INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day_local, path, product_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_product_day
  ON analytics_daily(product_id, day_local);

CREATE TABLE IF NOT EXISTS analytics_visitors (
  visitor_key TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
