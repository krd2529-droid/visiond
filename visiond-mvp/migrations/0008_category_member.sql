ALTER TABLE products ADD COLUMN product_kind TEXT NOT NULL DEFAULT 'product';
ALTER TABLE products ADD COLUMN member_category TEXT;
ALTER TABLE products ADD COLUMN member_duration_months INTEGER;

CREATE TABLE IF NOT EXISTS category_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category_slug TEXT NOT NULL,
  order_id INTEGER NOT NULL,
  starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, category_slug),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_category_memberships_user ON category_memberships(user_id,active,expires_at);
CREATE INDEX IF NOT EXISTS idx_category_memberships_category ON category_memberships(category_slug,active,expires_at);
