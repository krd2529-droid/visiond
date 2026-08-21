ALTER TABLE partner_commerce_orders ADD COLUMN native_order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT;
ALTER TABLE partner_commerce_orders ADD COLUMN fulfilled_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_commerce_native_order_unique ON partner_commerce_orders(native_order_id) WHERE native_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS partner_commerce_claims (
  claim_hash TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  token_ciphertext TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES partner_commerce_orders(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_partner_commerce_claim_user ON partner_commerce_claims(user_id,expires_at);

INSERT INTO runtime_schema_state(schema_key,version)
VALUES('core',68)
ON CONFLICT(schema_key) DO UPDATE SET version=excluded.version,updated_at=CURRENT_TIMESTAMP;
