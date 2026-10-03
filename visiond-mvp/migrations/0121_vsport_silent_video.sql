-- Only the current private silent render is exposed per project. Upload rows
-- retain the exact multipart receipt for safe retries after an uncertain reply.
CREATE TABLE IF NOT EXISTS vsport_silent_videos (
  project_id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK(mime_type='video/webm'),
  file_size INTEGER NOT NULL CHECK(file_size>0),
  duration_seconds REAL NOT NULL CHECK(duration_seconds>0 AND duration_seconds<=2101),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES vsport_projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vsport_silent_videos_owner_project ON vsport_silent_videos(owner_id,project_id);

CREATE TABLE IF NOT EXISTS vsport_video_uploads (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  r2_upload_id TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL CHECK(mime_type='video/webm'),
  file_size INTEGER NOT NULL,
  duration_seconds REAL NOT NULL,
  parts_json TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'initiating' CHECK(state IN ('initiating','uploading','completing','done','aborted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES vsport_projects(id) ON DELETE CASCADE,
  UNIQUE(owner_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_vsport_video_uploads_owner_project ON vsport_video_uploads(owner_id,project_id,state,updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vsport_video_uploads_one_active
  ON vsport_video_uploads(owner_id,project_id)
  WHERE state IN ('initiating','uploading','completing');

-- Project deletion cascades upload rows. Preserve exact multipart IDs until R2
-- confirms abort, so an unfinished upload is never forgotten by the replay path.
CREATE TABLE IF NOT EXISTS vsport_video_abort_jobs (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  r2_upload_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','error','done')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_vsport_video_abort_owner_project ON vsport_video_abort_jobs(owner_id,project_id,status,id);
