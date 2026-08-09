-- Preserve the product name shown at the time of purchase.
ALTER TABLE order_items ADD COLUMN product_title TEXT;
UPDATE order_items
SET product_title=(SELECT title FROM products WHERE products.id=order_items.product_id)
WHERE product_title IS NULL;
