ALTER TABLE vsport_image_candidates ADD COLUMN subject_kind TEXT NOT NULL DEFAULT '';
ALTER TABLE vsport_image_candidates ADD COLUMN subject_name TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_vsport_candidates_project_subject_script ON vsport_image_candidates(project_id,script_hash,subject_kind,subject_name,id);
