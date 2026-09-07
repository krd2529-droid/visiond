CREATE TABLE IF NOT EXISTS daily_seo_runs (
  run_day TEXT PRIMARY KEY,
  requested_limit INTEGER NOT NULL DEFAULT 5,
  created_count INTEGER NOT NULL DEFAULT 0,
  page_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
  error_code TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
