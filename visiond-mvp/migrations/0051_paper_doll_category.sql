INSERT INTO categories(slug,name,parent_slug,file_type,active,sort_order)
VALUES('paper-doll','ตุ๊กตากระดาษ',NULL,'PDF',1,27)
ON CONFLICT(slug) DO UPDATE SET
  name=excluded.name,
  parent_slug=NULL,
  file_type=excluded.file_type,
  active=1,
  sort_order=excluded.sort_order,
  updated_at=CURRENT_TIMESTAMP;
