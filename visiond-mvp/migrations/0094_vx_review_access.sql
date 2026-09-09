CREATE TABLE IF NOT EXISTS vx_review_access_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  scope TEXT NOT NULL DEFAULT 'tiktok_app_review' CHECK(scope='tiktok_app_review'),
  account_limit INTEGER NOT NULL DEFAULT 1 CHECK(account_limit=1),
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  superseded_at TEXT,
  created_by INTEGER NOT NULL,
  revoked_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(revoked_by) REFERENCES users(id) ON DELETE RESTRICT,
  CHECK(julianday(starts_at) IS NOT NULL AND julianday(expires_at) IS NOT NULL
    AND julianday(expires_at)>julianday(starts_at) AND julianday(expires_at)<=julianday(starts_at)+30)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vx_review_access_one_open
ON vx_review_access_grants(user_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vx_review_access_user_active
ON vx_review_access_grants(user_id,revoked_at,expires_at DESC,id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vx_review_access_current_user
ON vx_review_access_grants(user_id) WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vx_review_access_current_list
ON vx_review_access_grants(id DESC) WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_lower
ON users(lower(email));

CREATE INDEX IF NOT EXISTS idx_users_username_lower
ON users(lower(username));
