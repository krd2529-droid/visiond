CREATE TABLE IF NOT EXISTS vision7_smsmix_bindings (
  license_id TEXT PRIMARY KEY REFERENCES vision7_licenses(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'Android',
  generation INTEGER NOT NULL DEFAULT 1,
  activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
