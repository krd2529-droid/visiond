ALTER TABLE vision14_source_pages ADD COLUMN extraction_method TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE vision14_source_pages ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'success';
ALTER TABLE vision14_source_pages ADD COLUMN extraction_error TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_v14_pages_status ON vision14_source_pages(source_id,extraction_status,page_number);
