ALTER TABLE vpage_pages
ADD COLUMN create_content_json TEXT NOT NULL DEFAULT ''
CHECK(length(create_content_json)<=131072);

ALTER TABLE vpage_pages
ADD COLUMN create_active_set INTEGER NOT NULL DEFAULT 1
CHECK(create_active_set IN (1,2));
