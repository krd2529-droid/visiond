CREATE TABLE IF NOT EXISTS veasy_chat_messages (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  platform_message_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(shop_id,conversation_id) REFERENCES veasy_conversations(shop_id,id) ON DELETE CASCADE,
  UNIQUE(shop_id,platform_message_id,role)
);
CREATE INDEX IF NOT EXISTS idx_veasy_chat_history ON veasy_chat_messages(shop_id,conversation_id,created_at DESC);
