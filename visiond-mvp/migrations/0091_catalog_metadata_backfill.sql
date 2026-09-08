-- v0.20.62: bounded catalog metadata backfill.
-- Each statement advances at most 100 unfinished rows through a metadata-only trigger.
-- The public revision trigger remains installed throughout, and per-row version is the durable checkpoint.
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);
UPDATE products SET storefront_meta_version=0 WHERE id IN (SELECT id FROM products WHERE storefront_meta_version<>1 ORDER BY id LIMIT 100);

UPDATE storefront_catalog_metadata_state
SET ready=CASE WHEN EXISTS(SELECT 1 FROM products WHERE storefront_meta_version<>1 LIMIT 1) THEN 0 ELSE 1 END,
    updated_at=CURRENT_TIMESTAMP
WHERE id=1;
INSERT INTO runtime_schema_state(schema_key,version,updated_at)
SELECT 'storefront_catalog',91,CURRENT_TIMESTAMP
WHERE NOT EXISTS(SELECT 1 FROM products WHERE storefront_meta_version<>1 LIMIT 1)
ON CONFLICT(schema_key) DO UPDATE SET version=excluded.version,updated_at=CURRENT_TIMESTAMP;
INSERT INTO settings(key,value,updated_at)
SELECT 'storefront_catalog_revision',lower(hex(randomblob(16))),CURRENT_TIMESTAMP
WHERE NOT EXISTS(SELECT 1 FROM products WHERE storefront_meta_version<>1 LIMIT 1)
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
