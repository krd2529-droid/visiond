CREATE TABLE IF NOT EXISTS admin_account_vault(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  login_url TEXT NOT NULL,
  login_id_ciphertext TEXT NOT NULL,
  login_id_last4 TEXT NOT NULL DEFAULT '',
  email_ciphertext TEXT NOT NULL DEFAULT '',
  email_hint TEXT NOT NULL DEFAULT '',
  phone_ciphertext TEXT NOT NULL DEFAULT '',
  phone_last4 TEXT NOT NULL DEFAULT '',
  password_ciphertext TEXT NOT NULL,
  password_last4 TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_admin_account_vault_owner ON admin_account_vault(owner_user_id,updated_at DESC);
