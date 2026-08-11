CREATE TABLE IF NOT EXISTS user_terms_acceptances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  terms_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash TEXT NOT NULL,
  UNIQUE(user_id, terms_version),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user
  ON user_terms_acceptances(user_id, accepted_at DESC);
