ALTER TABLE veasy_chat_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE veasy_chat_messages ADD COLUMN media_url TEXT NOT NULL DEFAULT '';
ALTER TABLE veasy_chat_messages ADD COLUMN media_mime TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_v12_connect_platform_updated
ON veasy_conversations(platform,updated_at DESC);
