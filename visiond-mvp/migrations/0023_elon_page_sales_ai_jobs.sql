CREATE TABLE IF NOT EXISTS elon_page_ai_jobs (
  id TEXT PRIMARY KEY,
  input_message_key TEXT NOT NULL UNIQUE,
  conversation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY(conversation_id) REFERENCES elon_page_conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_elon_page_ai_jobs_due ON elon_page_ai_jobs(status,next_attempt_at);
