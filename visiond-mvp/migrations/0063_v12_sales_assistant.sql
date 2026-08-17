CREATE TABLE IF NOT EXISTS v12_lead_insights (
  shop_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('new','exploring','interested','ready','follow_up')),
  intent TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  objections TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  suggested_reply TEXT NOT NULL DEFAULT '',
  source_message_count INTEGER NOT NULL DEFAULT 0,
  analyzed_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(shop_id,conversation_id),
  FOREIGN KEY(analyzed_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_v12_lead_stage ON v12_lead_insights(stage,updated_at DESC);
