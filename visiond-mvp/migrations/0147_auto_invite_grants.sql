CREATE TABLE IF NOT EXISTS auto_invite_grants (
  id INTEGER PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  program_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  issuer_id INTEGER NOT NULL,
  machine_id TEXT NOT NULL,
  duration_days INTEGER,
  expires_at TEXT,
  key_ciphertext TEXT NOT NULL DEFAULT '',
  key_last4 TEXT NOT NULL DEFAULT '',
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(program_id) REFERENCES vision7_programs(id),
  FOREIGN KEY(recipient_id) REFERENCES users(id),
  FOREIGN KEY(issuer_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_auto_invite_grants_recipient ON auto_invite_grants(program_id,recipient_id,expires_at,id DESC);
CREATE INDEX IF NOT EXISTS idx_auto_invite_grants_recent ON auto_invite_grants(id DESC);
CREATE INDEX IF NOT EXISTS idx_auto_invite_grants_user ON auto_invite_grants(recipient_id,id DESC);
