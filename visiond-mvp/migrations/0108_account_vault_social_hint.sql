ALTER TABLE admin_account_vault
  ADD COLUMN record_kind TEXT NOT NULL DEFAULT 'legacy_full_password'
  CHECK(record_kind IN ('legacy_full_password','social_password_hint'));

ALTER TABLE admin_account_vault
  ADD COLUMN encryption_context TEXT NOT NULL DEFAULT '';

ALTER TABLE admin_account_vault
  ADD COLUMN password_hint_ciphertext TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_admin_account_vault_owner_kind_id
  ON admin_account_vault(owner_user_id,record_kind,id DESC);
