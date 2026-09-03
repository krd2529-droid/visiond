CREATE TABLE IF NOT EXISTS admin_work_note_attachments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(note_id) REFERENCES admin_work_notes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_work_note_attachments_note ON admin_work_note_attachments(note_id,sort_order,id);
