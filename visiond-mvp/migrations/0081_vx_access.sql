-- Runtime compatibility in functions/_vx_access.js creates the same schema.
CREATE TABLE IF NOT EXISTS vx_access_grants (
  order_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  plan_slug TEXT NOT NULL,
  account_limit INTEGER NOT NULL CHECK(account_limit IN (10,20,30)),
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vx_access_user ON vx_access_grants(user_id,expires_at);
