CREATE TABLE IF NOT EXISTS toys_center_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  client_token_hash TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  product_id INTEGER REFERENCES toys_center_products(id) ON DELETE SET NULL,
  product_meta_id TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  product_title TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'THB',
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 999),
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  payment_bank_name TEXT NOT NULL,
  payment_account_name TEXT NOT NULL,
  payment_account_number TEXT NOT NULL,
  payment_qr_url TEXT NOT NULL DEFAULT '',
  payment_message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK(status IN ('awaiting_payment','confirming','paid','rejected')),
  confirmation_token TEXT UNIQUE,
  reviewed_by INTEGER,
  paid_at TEXT,
  rejected_at TEXT,
  stock_decremented_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_toys_center_orders_status_cursor
  ON toys_center_orders(status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_toys_center_orders_cursor
  ON toys_center_orders(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_toys_center_orders_product_status
  ON toys_center_orders(product_id,status,id DESC);
