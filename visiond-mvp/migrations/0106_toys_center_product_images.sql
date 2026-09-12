CREATE TABLE IF NOT EXISTS toys_center_product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES toys_center_products(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 9),
  image_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, position)
);

CREATE INDEX IF NOT EXISTS idx_toys_center_product_images_product_position
  ON toys_center_product_images(product_id, position);

INSERT OR IGNORE INTO toys_center_product_images(product_id, position, image_key)
SELECT id, 0, image_1_key
FROM toys_center_products
WHERE image_1_key <> '';
