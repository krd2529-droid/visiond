PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS elon_v7_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO elon_v7_settings(key,value) VALUES('enabled','0');
CREATE TABLE IF NOT EXISTS elon_v7_migration_state (id INTEGER PRIMARY KEY CHECK(id=1),status TEXT NOT NULL DEFAULT 'reserved',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO elon_v7_migration_state(id,status) VALUES(1,'reserved');
