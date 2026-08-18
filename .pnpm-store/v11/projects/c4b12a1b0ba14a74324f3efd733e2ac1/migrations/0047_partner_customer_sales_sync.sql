CREATE TABLE IF NOT EXISTS partner_customers (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL,
  external_customer_id TEXT NOT NULL,
  profile_ciphertext TEXT NOT NULL,
  email_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','deleted')),
  external_created_at TEXT,
  last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id,external_customer_id),
  FOREIGN KEY(website_id) REFERENCES partner_websites(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_customers_website ON partner_customers(website_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS partner_orders (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL,
  external_order_id TEXT NOT NULL,
  external_customer_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','paid','cancelled','partially_refunded','refunded')),
  payment_status TEXT NOT NULL CHECK(payment_status IN ('unpaid','pending','paid','failed','partially_refunded','refunded')),
  currency TEXT NOT NULL DEFAULT 'THB',
  subtotal INTEGER NOT NULL CHECK(subtotal>=0),
  discount INTEGER NOT NULL DEFAULT 0 CHECK(discount>=0),
  total INTEGER NOT NULL CHECK(total>=0),
  refunded_amount INTEGER NOT NULL DEFAULT 0 CHECK(refunded_amount>=0),
  external_created_at TEXT,
  external_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id,external_order_id),
  FOREIGN KEY(website_id) REFERENCES partner_websites(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_orders_website ON partner_orders(website_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS partner_order_items (
  order_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  external_product_id TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity>0),
  unit_price INTEGER NOT NULL CHECK(unit_price>=0),
  line_total INTEGER NOT NULL CHECK(line_total>=0),
  PRIMARY KEY(order_id,line_index),
  FOREIGN KEY(order_id) REFERENCES partner_orders(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS partner_refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  external_refund_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>0),
  status TEXT NOT NULL CHECK(status IN ('pending','completed','failed')),
  reason TEXT NOT NULL DEFAULT '',
  external_created_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id,external_refund_id),
  FOREIGN KEY(order_id) REFERENCES partner_orders(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS partner_idempotency (
  website_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(website_id,idempotency_key),
  FOREIGN KEY(website_id) REFERENCES partner_websites(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_idempotency_created ON partner_idempotency(created_at);
