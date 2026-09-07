CREATE TABLE IF NOT EXISTS tiktok_commission_cards (
  id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,date_from TEXT NOT NULL,date_to TEXT NOT NULL,currency TEXT NOT NULL,basis TEXT NOT NULL,data_fingerprint TEXT NOT NULL,page_number INTEGER NOT NULL,page_count INTEGER NOT NULL,object_key TEXT NOT NULL UNIQUE,file_size INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id,date_from,date_to,currency,basis,data_fingerprint,page_number)
);
CREATE INDEX IF NOT EXISTS idx_tiktok_commission_cards_range ON tiktok_commission_cards(user_id,date_from,date_to,currency,basis,created_at DESC);
