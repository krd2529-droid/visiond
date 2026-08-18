-- Vision 7 program licensing + ELON Page isolated channel foundation.
CREATE TABLE IF NOT EXISTS vision7_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER UNIQUE,
  code TEXT NOT NULL UNIQUE,
  platform_type TEXT NOT NULL DEFAULT 'windows',
  current_version TEXT NOT NULL DEFAULT '1.0.0',
  minimum_version TEXT NOT NULL DEFAULT '1.0.0',
  requires_online INTEGER NOT NULL DEFAULT 1,
  force_update INTEGER NOT NULL DEFAULT 0,
  max_devices INTEGER NOT NULL DEFAULT 3,
  trial_hours INTEGER NOT NULL DEFAULT 24,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vision7_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL,
  plan_code TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(program_id,plan_code),
  FOREIGN KEY(program_id) REFERENCES vision7_programs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vision7_licenses (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  key_last4 TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  program_id INTEGER NOT NULL,
  plan_id INTEGER,
  order_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  max_devices INTEGER NOT NULL DEFAULT 3,
  source TEXT NOT NULL DEFAULT 'admin',
  note TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(program_id) REFERENCES vision7_programs(id) ON DELETE CASCADE,
  FOREIGN KEY(plan_id) REFERENCES vision7_plans(id) ON DELETE SET NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vision7_license_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  UNIQUE(license_id,device_hash),
  FOREIGN KEY(license_id) REFERENCES vision7_licenses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vision7_trial_entitlements (
  user_id INTEGER NOT NULL,
  program_id INTEGER NOT NULL,
  license_id TEXT,
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  expires_at TEXT,
  PRIMARY KEY(user_id,program_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(program_id) REFERENCES vision7_programs(id) ON DELETE CASCADE,
  FOREIGN KEY(license_id) REFERENCES vision7_licenses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vision7_license_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL,
  actor_user_id INTEGER,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(license_id) REFERENCES vision7_licenses(id) ON DELETE CASCADE,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS elon_page_conversations (
  id TEXT PRIMARY KEY,
  participant_hash TEXT NOT NULL UNIQUE,
  participant_ref TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT 'ลูกค้าจาก Facebook',
  status TEXT NOT NULL DEFAULT 'bot_active',
  assigned_user_id INTEGER,
  source_campaign TEXT NOT NULL DEFAULT '',
  source_creative TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL DEFAULT (datetime('now','+60 days')),
  FOREIGN KEY(assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS elon_page_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  platform_message_id TEXT UNIQUE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'page_sales',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(conversation_id) REFERENCES elon_page_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_v7_program_active ON vision7_programs(active,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_v7_license_user ON vision7_licenses(user_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_v7_license_program ON vision7_licenses(program_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_v7_devices_license ON vision7_license_devices(license_id,revoked_at,last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_v7_events_license ON vision7_license_events(license_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_elon_page_status ON elon_page_conversations(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_elon_page_messages_conversation ON elon_page_messages(conversation_id,created_at DESC,id DESC);

