ALTER TABLE vpage_content_sets ADD COLUMN background_color TEXT DEFAULT NULL;
ALTER TABLE vpage_content_sets ADD COLUMN text_font TEXT NOT NULL DEFAULT 'system';
ALTER TABLE vpage_content_sets ADD COLUMN text_color TEXT NOT NULL DEFAULT '#073b38';
