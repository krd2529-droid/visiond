CREATE TABLE IF NOT EXISTS auto_invite_issues (
  order_item_id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  program_id INTEGER NOT NULL,
  machine_id TEXT NOT NULL,
  key_ciphertext TEXT NOT NULL,
  key_last4 TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(program_id) REFERENCES vision7_programs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auto_invite_issues_user ON auto_invite_issues(user_id,order_item_id DESC);
CREATE INDEX IF NOT EXISTS idx_auto_invite_issues_program ON auto_invite_issues(program_id,order_item_id DESC);
CREATE INDEX IF NOT EXISTS idx_auto_invite_order_items_product ON order_items(product_id,id DESC);
