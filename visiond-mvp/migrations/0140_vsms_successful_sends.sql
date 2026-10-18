CREATE TABLE IF NOT EXISTS vision7_smsmix_successful_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL REFERENCES vision7_licenses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  device_hash TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  recipient_phone TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(license_id, device_hash, campaign_id, row_index)
);
CREATE INDEX IF NOT EXISTS idx_vsms_success_recent ON vision7_smsmix_successful_sends(id DESC);
