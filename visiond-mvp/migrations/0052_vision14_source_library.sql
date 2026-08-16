CREATE TABLE IF NOT EXISTS vision14_sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size INTEGER NOT NULL DEFAULT 0,
  rights_status TEXT NOT NULL DEFAULT 'reference_only',
  rights_note TEXT NOT NULL DEFAULT '',
  processing_status TEXT NOT NULL DEFAULT 'source_received',
  sale_eligible INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_v14_sources_created ON vision14_sources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_v14_sources_rights ON vision14_sources(rights_status,sale_eligible);
