CREATE TABLE IF NOT EXISTS tiktok_oauth_handoffs (
 id TEXT PRIMARY KEY, ticket_hash TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL,
 session_id TEXT NOT NULL, slot_id TEXT NOT NULL, channel_id TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider IN ('tiktok','shop')),
 intent TEXT NOT NULL CHECK(intent IN ('new','reconnect')),
 access_source TEXT NOT NULL, access_id INTEGER, account_limit INTEGER,
 state_hash TEXT UNIQUE, nonce_hash TEXT, status TEXT NOT NULL DEFAULT 'issued'
 CHECK(status IN ('issued','redeemed','processing','complete')),
 expires_at TEXT NOT NULL, CHECK(julianday(expires_at) IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_tiktok_handoff_expiry ON tiktok_oauth_handoffs(expires_at,id);
CREATE INDEX IF NOT EXISTS idx_tiktok_handoff_login_channel ON tiktok_connections(channel_id,user_id,status,open_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_handoff_shop_channel ON tiktok_shop_creator_connections(channel_id,user_id,status,open_id);
CREATE TABLE IF NOT EXISTS tiktok_oauth_handoff_heads (
 slot_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, handoff_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tiktok_oauth_handoff_guard (
 id TEXT PRIMARY KEY NOT NULL
);
CREATE TRIGGER IF NOT EXISTS trg_tiktok_handoff_head_owner
BEFORE UPDATE ON tiktok_oauth_handoff_heads WHEN OLD.user_id<>NEW.user_id
BEGIN SELECT RAISE(ABORT,'HANDOFF_OWNER_CONFLICT'); END;
CREATE TRIGGER IF NOT EXISTS trg_tiktok_handoff_cleanup_head
AFTER DELETE ON tiktok_oauth_handoffs
BEGIN DELETE FROM tiktok_oauth_handoff_heads WHERE slot_id=OLD.slot_id AND handoff_id=OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_tiktok_connections_active_identity_insert
BEFORE INSERT ON tiktok_connections
WHEN NEW.status='active' AND EXISTS(SELECT 1 FROM tiktok_connections c WHERE c.user_id=NEW.user_id AND c.open_id=NEW.open_id AND c.status='active' AND c.channel_id<>NEW.channel_id UNION ALL SELECT 1 FROM tiktok_connections c WHERE c.channel_id=NEW.channel_id AND c.status='active' AND c.user_id=NEW.user_id AND c.open_id<>NEW.open_id)
BEGIN SELECT RAISE(ABORT,'TIKTOK_ACTIVE_IDENTITY_CONFLICT'); END;
CREATE TRIGGER IF NOT EXISTS trg_tiktok_connections_active_identity_update
BEFORE UPDATE OF user_id,channel_id,open_id,status ON tiktok_connections
WHEN NEW.status='active' AND ((OLD.status='active' AND (OLD.user_id<>NEW.user_id OR OLD.channel_id<>NEW.channel_id OR OLD.open_id<>NEW.open_id)) OR EXISTS(SELECT 1 FROM tiktok_connections c WHERE c.id<>OLD.id AND c.user_id=NEW.user_id AND c.open_id=NEW.open_id AND c.status='active' AND c.channel_id<>NEW.channel_id UNION ALL SELECT 1 FROM tiktok_connections c WHERE c.id<>OLD.id AND c.channel_id=NEW.channel_id AND c.status='active' AND c.user_id=NEW.user_id AND c.open_id<>NEW.open_id))
BEGIN SELECT RAISE(ABORT,'TIKTOK_ACTIVE_IDENTITY_CONFLICT'); END;
CREATE TRIGGER IF NOT EXISTS trg_tiktok_shop_creator_connections_active_identity_insert
BEFORE INSERT ON tiktok_shop_creator_connections
WHEN NEW.status='active' AND EXISTS(SELECT 1 FROM tiktok_shop_creator_connections c WHERE c.user_id=NEW.user_id AND c.open_id=NEW.open_id AND c.status='active' AND c.channel_id<>NEW.channel_id UNION ALL SELECT 1 FROM tiktok_shop_creator_connections c WHERE c.channel_id=NEW.channel_id AND c.status='active' AND c.user_id=NEW.user_id AND c.open_id<>NEW.open_id)
BEGIN SELECT RAISE(ABORT,'TIKTOK_ACTIVE_IDENTITY_CONFLICT'); END;
CREATE TRIGGER IF NOT EXISTS trg_tiktok_shop_creator_connections_active_identity_update
BEFORE UPDATE OF user_id,channel_id,open_id,status ON tiktok_shop_creator_connections
WHEN NEW.status='active' AND ((OLD.status='active' AND (OLD.user_id<>NEW.user_id OR OLD.channel_id<>NEW.channel_id OR OLD.open_id<>NEW.open_id)) OR EXISTS(SELECT 1 FROM tiktok_shop_creator_connections c WHERE c.id<>OLD.id AND c.user_id=NEW.user_id AND c.open_id=NEW.open_id AND c.status='active' AND c.channel_id<>NEW.channel_id UNION ALL SELECT 1 FROM tiktok_shop_creator_connections c WHERE c.id<>OLD.id AND c.channel_id=NEW.channel_id AND c.status='active' AND c.user_id=NEW.user_id AND c.open_id<>NEW.open_id))
BEGIN SELECT RAISE(ABORT,'TIKTOK_ACTIVE_IDENTITY_CONFLICT'); END;
