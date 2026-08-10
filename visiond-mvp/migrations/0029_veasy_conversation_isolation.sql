CREATE TABLE IF NOT EXISTS veasy_conversations (
  shop_id TEXT NOT NULL,
  id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'facebook',
  participant_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'ลูกค้า',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(shop_id,id),
  UNIQUE(shop_id,platform,participant_hash),
  FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE,
  CHECK(status IN ('active','closed','blocked'))
);
CREATE INDEX IF NOT EXISTS idx_veasy_conversation_shop ON veasy_conversations(shop_id,status,updated_at DESC);
