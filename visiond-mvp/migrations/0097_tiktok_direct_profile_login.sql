ALTER TABLE tiktok_browser_profile_bindings ADD COLUMN profile_kind TEXT NOT NULL DEFAULT 'slot' CHECK(profile_kind IN ('slot','channel'));
ALTER TABLE tiktok_oauth_handoffs ADD COLUMN profile_kind TEXT NOT NULL DEFAULT 'slot' CHECK(profile_kind IN ('slot','channel'));
ALTER TABLE tiktok_oauth_handoffs ADD COLUMN continuation TEXT NOT NULL DEFAULT '' CHECK(continuation IN ('','shop'));
CREATE TRIGGER IF NOT EXISTS trg_tiktok_profile_kind_immutable
BEFORE UPDATE OF profile_kind ON tiktok_browser_profile_bindings WHEN OLD.profile_kind<>NEW.profile_kind
BEGIN SELECT RAISE(ABORT,'TIKTOK_PROFILE_KIND_IMMUTABLE'); END;
