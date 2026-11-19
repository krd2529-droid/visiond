ALTER TABLE auto_invite_issues ADD COLUMN plan_code TEXT NOT NULL DEFAULT 'lifetime';
ALTER TABLE auto_invite_issues ADD COLUMN expires_at TEXT;
CREATE INDEX IF NOT EXISTS idx_auto_invite_issues_renewal ON auto_invite_issues(user_id,machine_id,plan_code,expires_at DESC);
