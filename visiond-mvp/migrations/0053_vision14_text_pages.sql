CREATE TABLE IF NOT EXISTS vision14_source_pages (
  source_id TEXT NOT NULL,page_number INTEGER NOT NULL,raw_text TEXT NOT NULL,clean_text TEXT NOT NULL,
  removed_credit_lines TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(source_id,page_number),
  FOREIGN KEY(source_id) REFERENCES vision14_sources(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_v14_pages_source ON vision14_source_pages(source_id,page_number);
