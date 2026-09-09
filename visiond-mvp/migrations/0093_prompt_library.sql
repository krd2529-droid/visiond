CREATE TABLE IF NOT EXISTS admin_prompt_library(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  title_key TEXT NOT NULL,
  model_label TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  source_note TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  prompt_text TEXT NOT NULL,
  prompt_sha256 TEXT NOT NULL,
  prompt_chars INTEGER NOT NULL,
  example_url TEXT NOT NULL DEFAULT '',
  example_note TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(created_by,prompt_sha256)
);

CREATE INDEX IF NOT EXISTS idx_prompt_library_owner_updated
ON admin_prompt_library(created_by,updated_at DESC,id DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_library_owner_title
ON admin_prompt_library(created_by,title_key ASC,id DESC);
