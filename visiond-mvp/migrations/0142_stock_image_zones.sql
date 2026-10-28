CREATE TABLE IF NOT EXISTS toys_center_zone_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES toys_center_products(id) ON DELETE CASCADE,
  zone TEXT NOT NULL CHECK(zone IN ('meta','group')),
  position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 9),
  image_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id,zone,position)
);

CREATE INDEX IF NOT EXISTS idx_toys_center_zone_images_product_zone_position
  ON toys_center_zone_images(product_id,zone,position);

ALTER TABLE toys_center_form_drafts ADD COLUMN group_keys_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE toys_center_products ADD COLUMN image_revision TEXT NOT NULL DEFAULT '';

INSERT INTO toys_center_zone_images(product_id,zone,position,image_key)
SELECT p.id,'meta',0,p.image_2_key
FROM toys_center_products p
WHERE p.image_2_key<>''
  AND NOT EXISTS(SELECT 1 FROM toys_center_zone_images z WHERE z.product_id=p.id AND z.zone='meta');
