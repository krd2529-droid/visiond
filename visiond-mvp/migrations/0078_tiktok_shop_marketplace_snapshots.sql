CREATE TABLE IF NOT EXISTS tiktok_shop_marketplace_snapshots(
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  units_sold INTEGER NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '{}',
  snapshot_date TEXT NOT NULL DEFAULT (date('now')),
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(connection_id) REFERENCES tiktok_shop_creator_connections(id) ON DELETE CASCADE,
  UNIQUE(connection_id,product_id,snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_tiktok_shop_marketplace_snapshot_latest ON tiktok_shop_marketplace_snapshots(connection_id,product_id,snapshot_date DESC,captured_at DESC);
