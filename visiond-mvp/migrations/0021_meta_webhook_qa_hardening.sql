ALTER TABLE elon_page_webhook_events ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE elon_page_webhook_events ADD COLUMN last_attempt_at TEXT;
ALTER TABLE elon_page_webhook_events ADD COLUMN event_timestamp TEXT;
CREATE INDEX IF NOT EXISTS idx_elon_page_webhook_retry ON elon_page_webhook_events(status,last_attempt_at);
