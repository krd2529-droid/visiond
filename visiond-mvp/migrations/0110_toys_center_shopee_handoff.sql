ALTER TABLE toys_center_products
  ADD COLUMN shopee_weight_g INTEGER
  CHECK (shopee_weight_g IS NULL OR shopee_weight_g > 0);

ALTER TABLE toys_center_products
  ADD COLUMN shopee_package_width_mm INTEGER
  CHECK (shopee_package_width_mm IS NULL OR shopee_package_width_mm > 0);

ALTER TABLE toys_center_products
  ADD COLUMN shopee_package_length_mm INTEGER
  CHECK (shopee_package_length_mm IS NULL OR shopee_package_length_mm > 0);

ALTER TABLE toys_center_products
  ADD COLUMN shopee_package_height_mm INTEGER
  CHECK (shopee_package_height_mm IS NULL OR shopee_package_height_mm > 0);

CREATE INDEX IF NOT EXISTS idx_toys_center_title_nocase_id
  ON toys_center_products(title COLLATE NOCASE, id);
