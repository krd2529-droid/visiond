CREATE TABLE IF NOT EXISTS partner_commerce_orders (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL,
  external_order_id TEXT NOT NULL,
  external_customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('created','pending_payment','pending_review','paid','fulfilled','cancelled','rejected','refunded')),
  currency TEXT NOT NULL DEFAULT 'THB' CHECK(currency='THB'),
  subtotal INTEGER NOT NULL CHECK(subtotal>=0),
  discount INTEGER NOT NULL DEFAULT 0 CHECK(discount>=0),
  total INTEGER NOT NULL CHECK(total>=0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id,external_order_id),
  FOREIGN KEY(website_id) REFERENCES partner_websites(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_commerce_orders_site_status ON partner_commerce_orders(website_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS partner_commerce_order_items (
  order_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100),
  unit_price INTEGER NOT NULL CHECK(unit_price>=0),
  line_total INTEGER NOT NULL CHECK(line_total>=0),
  PRIMARY KEY(order_id,line_index),
  FOREIGN KEY(order_id) REFERENCES partner_commerce_orders(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
);

INSERT INTO runtime_schema_state(schema_key,version)
VALUES('core',67)
ON CONFLICT(schema_key) DO UPDATE SET version=excluded.version,updated_at=CURRENT_TIMESTAMP;
