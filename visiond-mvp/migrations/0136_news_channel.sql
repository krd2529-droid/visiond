CREATE TABLE IF NOT EXISTS news_channel_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  news_day TEXT NOT NULL,
  source TEXT NOT NULL,
  headline TEXT NOT NULL,
  source_url TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  published_at TEXT,
  origin TEXT NOT NULL CHECK(origin IN ('index','manual')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id,news_day,source_url)
);
CREATE INDEX IF NOT EXISTS idx_news_channel_owner_day_id ON news_channel_items(owner_id,news_day,id);

CREATE TABLE IF NOT EXISTS news_channel_refresh (
  owner_id INTEGER NOT NULL,
  news_day TEXT NOT NULL,
  lease_until TEXT,
  refreshed_at TEXT,
  state TEXT NOT NULL DEFAULT 'pending',
  PRIMARY KEY(owner_id,news_day)
);
