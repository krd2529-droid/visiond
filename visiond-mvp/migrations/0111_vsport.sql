CREATE TABLE IF NOT EXISTS vsport_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  news_date TEXT NOT NULL,
  scope_mode TEXT NOT NULL CHECK(scope_mode IN ('specific_team','all_teams_for_day')),
  team_name TEXT NOT NULL DEFAULT '',
  target_minutes INTEGER NOT NULL DEFAULT 30 CHECK(target_minutes IN (25,30,35)),
  target_seconds REAL NOT NULL DEFAULT 0,
  narration_script TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  thumbnail_headline TEXT NOT NULL DEFAULT '',
  thumbnail_subheadline TEXT NOT NULL DEFAULT '',
  thumbnail_focus_text TEXT NOT NULL DEFAULT '',
  thumbnail_focus_asset_id INTEGER,
  thumbnail_palette TEXT NOT NULL DEFAULT 'red-yellow',
  thumbnail_layout TEXT NOT NULL DEFAULT 'split',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_vsport_projects_owner_updated ON vsport_projects(owner_id,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_vsport_projects_owner_title ON vsport_projects(owner_id,title,id DESC);

CREATE TABLE IF NOT EXISTS vsport_stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  team_name TEXT NOT NULL,
  publisher TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  selected INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES vsport_projects(id) ON DELETE CASCADE,
  UNIQUE(project_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_vsport_stories_project_sort ON vsport_stories(project_id,selected DESC,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_vsport_stories_project_id ON vsport_stories(project_id,id);

CREATE TABLE IF NOT EXISTS vsport_image_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  story_id INTEGER NOT NULL,
  source_url TEXT NOT NULL,
  source_page_url TEXT NOT NULL,
  publisher TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'candidate',
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES vsport_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(story_id) REFERENCES vsport_stories(id) ON DELETE CASCADE,
  UNIQUE(project_id,source_url)
);
CREATE INDEX IF NOT EXISTS idx_vsport_candidates_project_story ON vsport_image_candidates(project_id,story_id,id);
CREATE INDEX IF NOT EXISTS idx_vsport_candidates_project_id ON vsport_image_candidates(project_id,id);

CREATE TABLE IF NOT EXISTS vsport_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  story_id INTEGER NOT NULL,
  candidate_id INTEGER,
  owner_id INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  source_page_url TEXT NOT NULL,
  publisher TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES vsport_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(story_id) REFERENCES vsport_stories(id) ON DELETE CASCADE,
  FOREIGN KEY(candidate_id) REFERENCES vsport_image_candidates(id) ON DELETE SET NULL,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_vsport_assets_project_id ON vsport_assets(project_id,id);
CREATE INDEX IF NOT EXISTS idx_vsport_assets_owner_id ON vsport_assets(owner_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vsport_assets_candidate_unique ON vsport_assets(candidate_id) WHERE candidate_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS vsport_jobs (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  job_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  checkpoint TEXT NOT NULL DEFAULT '',
  error_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES users(id),
  FOREIGN KEY(project_id) REFERENCES vsport_projects(id) ON DELETE CASCADE,
  UNIQUE(owner_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_vsport_jobs_project_status ON vsport_jobs(project_id,status,updated_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_vsport_jobs_owner_project_updated ON vsport_jobs(owner_id,project_id,updated_at DESC,id);
