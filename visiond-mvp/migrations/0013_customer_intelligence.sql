-- v0.14.44 Customer Intelligence: privacy-bounded funnel and attribution events.
CREATE TABLE IF NOT EXISTS customer_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_key TEXT,
  user_id INTEGER,
  event_type TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  product_id INTEGER,
  order_id INTEGER,
  source TEXT NOT NULL DEFAULT '',
  medium TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_events_type_time ON customer_events(event_type,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_events_user_time ON customer_events(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_events_visitor_time ON customer_events(visitor_key,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_events_product_time ON customer_events(product_id,created_at DESC);
