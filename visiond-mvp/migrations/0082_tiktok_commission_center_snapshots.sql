CREATE TABLE IF NOT EXISTS tiktok_commission_center_snapshots (
  connection_id TEXT NOT NULL,
  commission_day TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'THB',
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'actual',
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (connection_id, commission_day, currency),
  FOREIGN KEY (connection_id) REFERENCES tiktok_shop_creator_connections(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tiktok_commission_center_day ON tiktok_commission_center_snapshots(connection_id, commission_day DESC);
