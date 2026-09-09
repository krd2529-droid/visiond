CREATE TABLE IF NOT EXISTS tiktok_oauth_profile_slots (
  state_hash TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(length(slot_id)=36 AND lower(slot_id)=slot_id
    AND substr(slot_id,9,1)='-' AND substr(slot_id,14,1)='-'
    AND substr(slot_id,19,1)='-' AND substr(slot_id,24,1)='-'
    AND length(replace(slot_id,'-',''))=32
    AND replace(slot_id,'-','') NOT GLOB '*[^0-9a-f]*'
    AND substr(slot_id,15,1) IN ('1','2','3','4','5')
    AND substr(slot_id,20,1) IN ('8','9','a','b')
    AND slot_id<>'00000000-0000-0000-0000-000000000000'),
  CHECK(julianday(expires_at) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_oauth_states_expiry
ON tiktok_oauth_states(expires_at,state_hash);

CREATE INDEX IF NOT EXISTS idx_tiktok_oauth_profile_slots_expiry
ON tiktok_oauth_profile_slots(expires_at,state_hash);

CREATE INDEX IF NOT EXISTS idx_tiktok_oauth_profile_slots_owner_slot
ON tiktok_oauth_profile_slots(user_id,slot_id);

CREATE TABLE IF NOT EXISTS tiktok_browser_profile_bindings (
  slot_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  provider_open_id TEXT NOT NULL,
  bound_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(length(slot_id)=36 AND lower(slot_id)=slot_id
    AND substr(slot_id,9,1)='-' AND substr(slot_id,14,1)='-'
    AND substr(slot_id,19,1)='-' AND substr(slot_id,24,1)='-'
    AND length(replace(slot_id,'-',''))=32
    AND replace(slot_id,'-','') NOT GLOB '*[^0-9a-f]*'
    AND substr(slot_id,15,1) IN ('1','2','3','4','5')
    AND substr(slot_id,20,1) IN ('8','9','a','b')
    AND slot_id<>'00000000-0000-0000-0000-000000000000'),
  CHECK(channel_id<>''),
  CHECK(provider_open_id<>''),
  UNIQUE(user_id,provider_open_id)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_browser_profile_bindings_owner_channel
ON tiktok_browser_profile_bindings(user_id,channel_id);

CREATE TRIGGER IF NOT EXISTS trg_tiktok_browser_profile_binding_prerequisite
BEFORE INSERT ON tiktok_browser_profile_bindings
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM tiktok_channels ch
    JOIN tiktok_connections c
      ON c.user_id=NEW.user_id
     AND c.channel_id=NEW.channel_id
     AND c.open_id=NEW.provider_open_id
     AND c.status='active'
    WHERE ch.id=NEW.channel_id
      AND ch.created_by=NEW.user_id
      AND ch.archived_at IS NULL
  ) THEN RAISE(ABORT,'TIKTOK_PROFILE_BINDING_PREREQUISITE') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_tiktok_browser_profile_binding_immutable
BEFORE UPDATE ON tiktok_browser_profile_bindings
WHEN OLD.slot_id<>NEW.slot_id
  OR OLD.user_id<>NEW.user_id
  OR OLD.channel_id<>NEW.channel_id
  OR OLD.provider_open_id<>NEW.provider_open_id
  OR OLD.bound_at<>NEW.bound_at
BEGIN
  SELECT RAISE(ABORT,'TIKTOK_PROFILE_BINDING_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_tiktok_connection_profile_insert_guard
BEFORE INSERT ON tiktok_connections
WHEN EXISTS (
  SELECT 1 FROM tiktok_browser_profile_bindings b
  WHERE b.user_id=NEW.user_id
    AND ((b.provider_open_id=NEW.open_id AND b.channel_id<>NEW.channel_id)
      OR (b.channel_id=NEW.channel_id AND b.provider_open_id<>NEW.open_id))
)
BEGIN
  SELECT RAISE(ABORT,'TIKTOK_PROFILE_BINDING_CONFLICT');
END;

CREATE TRIGGER IF NOT EXISTS trg_tiktok_connection_profile_update_guard
BEFORE UPDATE OF user_id,channel_id,open_id ON tiktok_connections
WHEN EXISTS (
  SELECT 1 FROM tiktok_browser_profile_bindings b
  WHERE (b.user_id=OLD.user_id
      AND (b.provider_open_id=OLD.open_id OR b.channel_id=OLD.channel_id)
      AND (NEW.user_id<>b.user_id OR NEW.channel_id<>b.channel_id OR NEW.open_id<>b.provider_open_id))
    OR (b.user_id=NEW.user_id
      AND ((b.provider_open_id=NEW.open_id AND b.channel_id<>NEW.channel_id)
        OR (b.channel_id=NEW.channel_id AND b.provider_open_id<>NEW.open_id)))
)
BEGIN
  SELECT RAISE(ABORT,'TIKTOK_PROFILE_BINDING_CONFLICT');
END;

CREATE TRIGGER IF NOT EXISTS trg_tiktok_browser_profile_binding_no_delete
BEFORE DELETE ON tiktok_browser_profile_bindings
BEGIN
  SELECT RAISE(ABORT,'TIKTOK_PROFILE_BINDING_IMMUTABLE');
END;
