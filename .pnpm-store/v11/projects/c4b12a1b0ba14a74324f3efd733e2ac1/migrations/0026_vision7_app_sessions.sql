CREATE TABLE IF NOT EXISTS vision7_app_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  device_hash TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_v7_app_session_user ON vision7_app_sessions(user_id,revoked_at,expires_at);
CREATE INDEX IF NOT EXISTS idx_v7_app_session_device ON vision7_app_sessions(user_id,device_hash,revoked_at);
