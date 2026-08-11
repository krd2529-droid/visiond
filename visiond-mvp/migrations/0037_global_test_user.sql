ALTER TABLE users ADD COLUMN is_test_user INTEGER NOT NULL DEFAULT 0;
UPDATE users SET is_test_user=1 WHERE vision5_test_account=1;
UPDATE users SET name='รัฐสิทธิ ดำรงรถการ' WHERE is_test_user=1;
CREATE INDEX IF NOT EXISTS idx_users_test_user ON users(is_test_user,id DESC);
