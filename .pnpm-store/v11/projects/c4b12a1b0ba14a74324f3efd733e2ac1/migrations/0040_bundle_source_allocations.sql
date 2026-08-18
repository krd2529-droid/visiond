CREATE TABLE IF NOT EXISTS bundle_source_allocations (
  source_product_id INTEGER PRIMARY KEY,
  bundle_product_id INTEGER NOT NULL,
  allocated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO bundle_source_allocations(source_product_id,bundle_product_id,allocated_at)
SELECT source_product_id,bundle_product_id,MIN(created_at)
FROM product_bundle_items
GROUP BY source_product_id;
