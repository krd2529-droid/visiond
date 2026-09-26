ALTER TABLE live_shows ADD COLUMN deleted_at TEXT;
ALTER TABLE live_shows ADD COLUMN deleted_by INTEGER REFERENCES users(id);
ALTER TABLE live_shows ADD COLUMN delete_idempotency_key TEXT;
ALTER TABLE live_shows ADD COLUMN delete_request_hash TEXT
  CHECK(delete_request_hash IS NULL OR LENGTH(delete_request_hash) = 64);

-- The recent-show query only serves active rows. Rebuild the original keyset
-- index as a partial index so deleted audit rows never add read amplification.
DROP INDEX IF EXISTS idx_live_shows_updated;
CREATE INDEX idx_live_shows_updated
  ON live_shows(updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_shows_owner_id
  ON live_shows(created_by, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_shows_delete_idempotency
  ON live_shows(deleted_by, delete_idempotency_key)
  WHERE delete_idempotency_key IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_live_show_tombstone_no_delete
BEFORE DELETE ON live_shows
BEGIN
  SELECT RAISE(ABORT, 'LIVE_SHOW_HARD_DELETE_FORBIDDEN');
END;

CREATE TRIGGER IF NOT EXISTS trg_live_show_tombstone_no_restore
BEFORE UPDATE OF deleted_at ON live_shows
WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'LIVE_SHOW_RESTORE_FORBIDDEN');
END;
