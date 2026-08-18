ALTER TABLE partner_webhook_events ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0 CHECK(duration_ms>=0);
CREATE INDEX IF NOT EXISTS idx_partner_webhook_health ON partner_webhook_events(website_id,received_at,status,duration_ms);
