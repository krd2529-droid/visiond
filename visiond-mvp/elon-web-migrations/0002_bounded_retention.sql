-- v0.20.62 optional ELON_WEB_DB migration. Never apply this file to the main VisionD DB.
CREATE TABLE IF NOT EXISTS elon_web_maintenance_jobs (
  job_key TEXT PRIMARY KEY,
  lease_token TEXT NOT NULL DEFAULT '',
  lease_expires_at TEXT,
  last_completed_at TEXT,
  next_run_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_elon_web_messages_retention ON elon_web_messages(created_at,id);
CREATE INDEX IF NOT EXISTS idx_elon_web_conversations_retention ON elon_web_conversations(created_at,id);
CREATE INDEX IF NOT EXISTS idx_elon_web_rate_limits_retention ON elon_web_rate_limits(window_start,subject_id);
CREATE INDEX IF NOT EXISTS idx_elon_web_usage_limits_retention ON elon_web_usage_limits(window_start,rate_key);
