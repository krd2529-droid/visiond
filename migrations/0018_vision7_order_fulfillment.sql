ALTER TABLE vision7_plans ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE vision7_licenses ADD COLUMN key_ciphertext TEXT NOT NULL DEFAULT '';
ALTER TABLE vision7_licenses ADD COLUMN renewed_at TEXT;
ALTER TABLE order_items ADD COLUMN vision7_renew_license_id TEXT REFERENCES vision7_licenses(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v7_plan_product ON vision7_plans(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_v7_renew ON order_items(vision7_renew_license_id) WHERE vision7_renew_license_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS vision7_order_fulfillments (
  order_item_id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  license_id TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY(license_id) REFERENCES vision7_licenses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_v7_fulfillment_order ON vision7_order_fulfillments(order_id,created_at DESC);
