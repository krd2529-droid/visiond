CREATE INDEX IF NOT EXISTS idx_product_files_product_latest
ON product_files(product_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_products_admin_status_id
ON products(status, id DESC)
WHERE deleted_at IS NULL AND COALESCE(product_kind,'product')='product';

CREATE INDEX IF NOT EXISTS idx_products_admin_category_status
ON products(category, status)
WHERE deleted_at IS NULL AND COALESCE(product_kind,'product')='product';

CREATE INDEX IF NOT EXISTS idx_products_public_cover
ON products(cover_url)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_public_preview_1
ON products(json_extract(preview_urls,'$[0]'))
WHERE deleted_at IS NULL AND json_valid(preview_urls);

CREATE INDEX IF NOT EXISTS idx_products_public_preview_2
ON products(json_extract(preview_urls,'$[1]'))
WHERE deleted_at IS NULL AND json_valid(preview_urls);

CREATE INDEX IF NOT EXISTS idx_products_public_preview_3
ON products(json_extract(preview_urls,'$[2]'))
WHERE deleted_at IS NULL AND json_valid(preview_urls);
