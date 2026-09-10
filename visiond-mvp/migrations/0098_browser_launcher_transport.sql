CREATE TABLE IF NOT EXISTS browser_launcher_helpers (
 id TEXT PRIMARY KEY, user_id INTEGER, session_id TEXT, owner_hash TEXT NOT NULL,
 port INTEGER NOT NULL CHECK(port BETWEEN 49152 AND 65535), key_version INTEGER NOT NULL DEFAULT 1,
 secret_cipher TEXT NOT NULL, pair_code TEXT NOT NULL, confirm_nonce TEXT,
 status TEXT NOT NULL CHECK(status IN ('staged','prepared','active','revoked')),
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_launcher_helper_owner ON browser_launcher_helpers(user_id,status,id);
CREATE INDEX IF NOT EXISTS idx_launcher_helper_expiry ON browser_launcher_helpers(status,expires_at,id);
CREATE TABLE IF NOT EXISTS browser_launcher_commands (
 id TEXT PRIMARY KEY, helper_id TEXT NOT NULL, key_version INTEGER NOT NULL, request_hash TEXT NOT NULL,
 user_id INTEGER NOT NULL, session_id TEXT NOT NULL, handoff_id TEXT UNIQUE,
 channel_id TEXT NOT NULL DEFAULT '', slot_id TEXT NOT NULL DEFAULT '', profile_kind TEXT NOT NULL DEFAULT 'slot' CHECK(profile_kind IN ('slot','channel')),
 access_source TEXT, access_id INTEGER,
 intent TEXT NOT NULL CHECK(intent IN ('oauth','view')), ticket_cipher TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','claimed','process_started','failed','unknown','cancelled')),
 expires_at TEXT NOT NULL, claimed_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(helper_id) REFERENCES browser_launcher_helpers(id)
);
CREATE INDEX IF NOT EXISTS idx_launcher_command_owner ON browser_launcher_commands(user_id,session_id,id);
CREATE INDEX IF NOT EXISTS idx_launcher_command_expiry ON browser_launcher_commands(expires_at,id);
CREATE TABLE IF NOT EXISTS browser_launcher_nonces (
 id TEXT PRIMARY KEY, helper_id TEXT NOT NULL, command_id TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('claim','status','pair-state')), expires_at TEXT NOT NULL,
 used_hash TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_launcher_nonce_expiry ON browser_launcher_nonces(expires_at,id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_launcher_nonce_command ON browser_launcher_nonces(helper_id,command_id,purpose);
CREATE TABLE IF NOT EXISTS browser_launcher_guard(id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS browser_launcher_cancelled (
 id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, session_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_launcher_cancelled_expiry ON browser_launcher_cancelled(created_at,id);
CREATE TRIGGER IF NOT EXISTS browser_launcher_cancelled_insert BEFORE INSERT ON browser_launcher_commands
WHEN EXISTS(SELECT 1 FROM browser_launcher_cancelled x WHERE x.id=NEW.id)
BEGIN SELECT RAISE(ABORT,'LAUNCHER_COMMAND_CANCELLED'); END;
CREATE TRIGGER IF NOT EXISTS browser_launcher_pending_head_guard BEFORE UPDATE OF handoff_id ON tiktok_oauth_handoff_heads
WHEN OLD.handoff_id<>NEW.handoff_id AND EXISTS(
 SELECT 1 FROM browser_launcher_commands c WHERE c.handoff_id=OLD.handoff_id
 AND c.status IN ('pending','claimed','process_started','unknown') AND c.expires_at>CURRENT_TIMESTAMP
) BEGIN SELECT RAISE(ABORT,'LAUNCHER_COMMAND_BUSY'); END;
