CREATE TABLE IF NOT EXISTS vx_workspace_delegations (
  id TEXT PRIMARY KEY,
  delegate_user_id INTEGER NOT NULL,
  owner_user_id INTEGER NOT NULL,
  scope TEXT NOT NULL CHECK(scope='boss_tiktok_channel_operator'),
  revoked_at TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(delegate_user_id<>owner_user_id),
  FOREIGN KEY(delegate_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vx_workspace_delegate_active
ON vx_workspace_delegations(delegate_user_id,scope)
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vx_workspace_owner_active
ON vx_workspace_delegations(owner_user_id,scope,delegate_user_id)
WHERE revoked_at IS NULL;

-- The assignment is deliberately exact and idempotent. It writes nothing unless
-- the normalized email identifies one ordinary user and production has one Boss.
INSERT OR IGNORE INTO vx_workspace_delegations
  (id,delegate_user_id,owner_user_id,scope,created_by)
SELECT 'testervx-boss-tiktok-channel-operator-v1',delegate.id,owner.id,
       'boss_tiktok_channel_operator',owner.id
FROM users delegate
JOIN users owner ON owner.role='boss'
WHERE lower(trim(delegate.email))='testervx@gmail.com'
  AND delegate.role='user'
  AND COALESCE(delegate.is_test_user,0)=0
  AND (SELECT COUNT(*) FROM users WHERE lower(trim(email))='testervx@gmail.com')=1
  AND (SELECT COUNT(*) FROM users WHERE role='boss')=1;

ALTER TABLE tiktok_oauth_handoffs ADD COLUMN actor_user_id INTEGER;
ALTER TABLE tiktok_oauth_handoffs ADD COLUMN workspace_owner_user_id INTEGER;
ALTER TABLE browser_launcher_commands ADD COLUMN actor_user_id INTEGER;
ALTER TABLE browser_launcher_commands ADD COLUMN workspace_owner_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_tiktok_handoff_actor_session
ON tiktok_oauth_handoffs(actor_user_id,session_id,id);

CREATE INDEX IF NOT EXISTS idx_tiktok_handoff_workspace_owner
ON tiktok_oauth_handoffs(workspace_owner_user_id,id);

CREATE INDEX IF NOT EXISTS idx_launcher_command_actor_session
ON browser_launcher_commands(actor_user_id,session_id,id);

CREATE INDEX IF NOT EXISTS idx_launcher_command_workspace_owner
ON browser_launcher_commands(workspace_owner_user_id,id);

ALTER TABLE tiktok_connections ADD COLUMN avatar_object_key TEXT NOT NULL DEFAULT '';
ALTER TABLE tiktok_connections ADD COLUMN avatar_mime_type TEXT NOT NULL DEFAULT '';
ALTER TABLE tiktok_connections ADD COLUMN avatar_file_size INTEGER NOT NULL DEFAULT 0 CHECK(avatar_file_size>=0 AND avatar_file_size<=2097152);
ALTER TABLE tiktok_connections ADD COLUMN avatar_revision TEXT NOT NULL DEFAULT '';
ALTER TABLE tiktok_connections ADD COLUMN avatar_mirrored_at TEXT;
ALTER TABLE tiktok_connections ADD COLUMN avatar_sync_generation INTEGER NOT NULL DEFAULT 0 CHECK(avatar_sync_generation>=0);

CREATE INDEX IF NOT EXISTS idx_tiktok_connections_owner_avatar
ON tiktok_connections(user_id,id,avatar_revision)
WHERE avatar_object_key<>'';

CREATE INDEX IF NOT EXISTS idx_tiktok_connections_owner_channel_latest
ON tiktok_connections(user_id,channel_id,status,updated_at DESC);
