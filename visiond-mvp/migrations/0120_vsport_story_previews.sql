CREATE TABLE IF NOT EXISTS vsport_story_previews (
  project_id INTEGER NOT NULL,
  story_id INTEGER NOT NULL,
  source_url TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  image_urls_json TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL CHECK(state IN ('found','empty','unavailable')),
  checked_at TEXT NOT NULL,
  PRIMARY KEY(project_id,story_id),
  FOREIGN KEY(project_id) REFERENCES vsport_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(story_id) REFERENCES vsport_stories(id) ON DELETE CASCADE
);
