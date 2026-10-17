CREATE INDEX IF NOT EXISTS idx_v7_storefront_active_id ON vision7_programs (active,id DESC);
CREATE INDEX IF NOT EXISTS idx_v7_storefront_group_id ON vision7_programs (
  active,
  (CASE WHEN platform_type IN ('windows','mac') THEN 'desktop' WHEN platform_type='web' THEN 'web' WHEN platform_type IN ('android','veasy') THEN 'mobile' ELSE 'other' END),
  id DESC
);
CREATE INDEX IF NOT EXISTS idx_v7_storefront_group_name ON vision7_programs (
  active,
  (CASE WHEN platform_type IN ('windows','mac') THEN 'desktop' WHEN platform_type='web' THEN 'web' WHEN platform_type IN ('android','veasy') THEN 'mobile' ELSE 'other' END),
  app_name COLLATE NOCASE,
  id DESC
);
CREATE INDEX IF NOT EXISTS idx_v7_storefront_name ON vision7_programs (active,app_name COLLATE NOCASE,id DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS vision7_program_search USING fts5(app_name,app_description,code,content='vision7_programs',content_rowid='id',tokenize='trigram');
CREATE TRIGGER IF NOT EXISTS vision7_program_search_insert AFTER INSERT ON vision7_programs BEGIN
  INSERT INTO vision7_program_search(rowid,app_name,app_description,code) VALUES(new.id,new.app_name,new.app_description,new.code);
END;
CREATE TRIGGER IF NOT EXISTS vision7_program_search_delete AFTER DELETE ON vision7_programs BEGIN
  INSERT INTO vision7_program_search(vision7_program_search,rowid,app_name,app_description,code) VALUES('delete',old.id,old.app_name,old.app_description,old.code);
END;
CREATE TRIGGER IF NOT EXISTS vision7_program_search_update AFTER UPDATE OF app_name,app_description,code ON vision7_programs BEGIN
  INSERT INTO vision7_program_search(vision7_program_search,rowid,app_name,app_description,code) VALUES('delete',old.id,old.app_name,old.app_description,old.code);
  INSERT INTO vision7_program_search(rowid,app_name,app_description,code) VALUES(new.id,new.app_name,new.app_description,new.code);
END;
INSERT INTO vision7_program_search(vision7_program_search) VALUES('rebuild');
