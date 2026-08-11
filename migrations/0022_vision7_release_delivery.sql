CREATE TABLE IF NOT EXISTS vision7_releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  minimum_version TEXT NOT NULL,
  mandatory INTEGER NOT NULL DEFAULT 0,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  release_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(program_id,version),
  FOREIGN KEY(program_id) REFERENCES vision7_programs(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_v7_release_program ON vision7_releases(program_id,status,published_at DESC);
