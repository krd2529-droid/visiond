CREATE INDEX IF NOT EXISTS idx_news_channel_owner_published_id
ON news_channel_items(owner_id,published_at DESC,id DESC)
WHERE origin='index' AND published_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_news_channel_owner_source_url
ON news_channel_items(owner_id,source_url);

CREATE INDEX IF NOT EXISTS idx_news_channel_owner_manual_id
ON news_channel_items(owner_id,origin,id DESC);
