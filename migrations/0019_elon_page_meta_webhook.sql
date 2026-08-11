ALTER TABLE elon_page_conversations ADD COLUMN participant_ciphertext TEXT NOT NULL DEFAULT '';
ALTER TABLE elon_page_conversations ADD COLUMN last_customer_message_at TEXT;
ALTER TABLE elon_page_conversations ADD COLUMN last_outbound_at TEXT;

CREATE TABLE IF NOT EXISTS elon_page_webhook_events (
  event_key TEXT PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'message',
  conversation_id TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  error_code TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(conversation_id) REFERENCES elon_page_conversations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_elon_page_webhook_status ON elon_page_webhook_events(status,received_at DESC);
CREATE INDEX IF NOT EXISTS idx_elon_page_customer_window ON elon_page_conversations(last_customer_message_at DESC);
