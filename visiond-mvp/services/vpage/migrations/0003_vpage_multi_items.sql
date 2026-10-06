CREATE TABLE vpage_product_items (
  page_id TEXT NOT NULL,
  set_no INTEGER NOT NULL CHECK(set_no IN (1,2)),
  position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 3),
  destination_url TEXT NOT NULL CHECK(length(destination_url) BETWEEN 1 AND 2048),
  image_url TEXT NOT NULL DEFAULT '' CHECK(length(image_url)<=2048),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(page_id,set_no,position),
  FOREIGN KEY(page_id,set_no) REFERENCES vpage_content_sets(page_id,set_no) ON DELETE CASCADE
);

CREATE TABLE vpage_contact_items (
  page_id TEXT NOT NULL,
  set_no INTEGER NOT NULL CHECK(set_no IN (1,2)),
  position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 3),
  contact_type TEXT NOT NULL CHECK(contact_type IN ('facebook','line')),
  destination_url TEXT NOT NULL CHECK(length(destination_url) BETWEEN 1 AND 2048),
  image_url TEXT NOT NULL DEFAULT '' CHECK(length(image_url)<=2048),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(page_id,set_no,position),
  FOREIGN KEY(page_id,set_no) REFERENCES vpage_content_sets(page_id,set_no) ON DELETE CASCADE
);

CREATE INDEX idx_vpage_product_items_set_order
ON vpage_product_items(page_id,set_no,position);

CREATE INDEX idx_vpage_contact_items_set_order
ON vpage_contact_items(page_id,set_no,position);

INSERT INTO vpage_product_items(page_id,set_no,position,destination_url)
SELECT page_id,set_no,1,product_url
FROM vpage_content_sets
WHERE length(trim(product_url))>0;

INSERT INTO vpage_contact_items(page_id,set_no,position,contact_type,destination_url)
SELECT page_id,set_no,1,
  CASE
    WHEN lower(contact_url) LIKE 'https://line.me/%' THEN 'line'
    WHEN lower(contact_url) LIKE 'https://facebook.com/%'
      OR lower(contact_url) LIKE 'https://%.facebook.com/%'
      OR lower(contact_url) LIKE 'https://m.me/%'
      OR lower(contact_url) LIKE 'https://%.m.me/%' THEN 'facebook'
    ELSE NULL
  END,
  contact_url
FROM vpage_content_sets
WHERE length(trim(contact_url))>0;
