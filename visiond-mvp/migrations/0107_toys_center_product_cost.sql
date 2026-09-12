ALTER TABLE toys_center_products
  ADD COLUMN cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0);
