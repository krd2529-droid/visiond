ALTER TABLE toys_center_products
  ADD COLUMN product_line TEXT NOT NULL DEFAULT '' CHECK (length(product_line) <= 120);

ALTER TABLE toys_center_products
  ADD COLUMN series TEXT NOT NULL DEFAULT '' CHECK (length(series) <= 120);
