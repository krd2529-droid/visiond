-- v0.14.45 Ads Intelligence
CREATE TABLE IF NOT EXISTS ad_campaign_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spend_date TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'facebook',
  campaign TEXT NOT NULL DEFAULT '',
  adset TEXT NOT NULL DEFAULT '',
  creative TEXT NOT NULL DEFAULT '',
  cost INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(spend_date,platform,campaign,adset,creative),
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ad_campaign_costs_date ON ad_campaign_costs(spend_date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_campaign_costs_campaign ON ad_campaign_costs(platform,campaign,spend_date DESC);
