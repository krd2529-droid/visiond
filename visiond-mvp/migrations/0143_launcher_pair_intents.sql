CREATE TABLE IF NOT EXISTS browser_launcher_pair_intents (
 id TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL,
 session_id TEXT NOT NULL,
 account_code TEXT NOT NULL,
 helper_id TEXT,
 consumed_at TEXT,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_launcher_pair_intent_expiry ON browser_launcher_pair_intents(expires_at,id);
CREATE INDEX IF NOT EXISTS idx_launcher_pair_intent_session ON browser_launcher_pair_intents(user_id,session_id,id);
