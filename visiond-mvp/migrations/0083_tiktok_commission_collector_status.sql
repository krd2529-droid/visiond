ALTER TABLE tiktok_shop_creator_connections ADD COLUMN collector_session_secret_name TEXT NOT NULL DEFAULT '';
ALTER TABLE tiktok_shop_creator_connections ADD COLUMN collector_status TEXT NOT NULL DEFAULT 'not_connected';
ALTER TABLE tiktok_shop_creator_connections ADD COLUMN collector_last_attempt_at TEXT;
ALTER TABLE tiktok_shop_creator_connections ADD COLUMN collector_last_success_at TEXT;
ALTER TABLE tiktok_shop_creator_connections ADD COLUMN collector_last_error TEXT NOT NULL DEFAULT '';
