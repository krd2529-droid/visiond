CREATE TABLE IF NOT EXISTS meta_ads_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  insight_date TEXT NOT NULL,
  account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL DEFAULT '',
  adset_id TEXT NOT NULL,
  adset_name TEXT NOT NULL DEFAULT '',
  ad_id TEXT NOT NULL,
  ad_name TEXT NOT NULL DEFAULT '',
  creative_id TEXT NOT NULL DEFAULT '',
  creative_name TEXT NOT NULL DEFAULT '',
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend INTEGER NOT NULL DEFAULT 0,
  actions TEXT NOT NULL DEFAULT '{}',
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(insight_date,account_id,ad_id)
);
CREATE INDEX IF NOT EXISTS idx_meta_ads_date ON meta_ads_insights(insight_date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_ads_hierarchy ON meta_ads_insights(campaign_id,adset_id,ad_id,insight_date DESC);
CREATE TABLE IF NOT EXISTS meta_ads_sync_runs (
  id TEXT PRIMARY KEY,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  status TEXT NOT NULL,
  rows_synced INTEGER NOT NULL DEFAULT 0,
  error_code TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
