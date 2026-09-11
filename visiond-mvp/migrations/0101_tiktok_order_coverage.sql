CREATE TABLE IF NOT EXISTS tiktok_shop_order_coverage (
 connection_id TEXT NOT NULL, date_from TEXT NOT NULL, date_to TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'never', page_token TEXT NOT NULL DEFAULT '',
 request_id TEXT NOT NULL DEFAULT '', lease_id TEXT NOT NULL DEFAULT '', lease_until INTEGER NOT NULL DEFAULT 0,
 pages INTEGER NOT NULL DEFAULT 0, synced_at TEXT, error_code TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(connection_id,date_from,date_to)
);
