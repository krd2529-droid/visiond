ALTER TABLE vsport_projects ADD COLUMN person_names_override TEXT NOT NULL DEFAULT '';
ALTER TABLE vsport_projects ADD COLUMN person_search_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE vsport_image_candidates ADD COLUMN person_name TEXT NOT NULL DEFAULT '';
ALTER TABLE vsport_image_candidates ADD COLUMN script_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE vsport_image_candidates ADD COLUMN license_code TEXT NOT NULL DEFAULT '';
ALTER TABLE vsport_image_candidates ADD COLUMN identity_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vsport_image_candidates ADD COLUMN story_association TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_vsport_candidates_project_person_script ON vsport_image_candidates(project_id,script_hash,person_name,id);
