CREATE INDEX IF NOT EXISTS idx_orders_user_id
ON orders(user_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_product
ON order_items(order_id, product_id);
