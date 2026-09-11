CREATE INDEX IF NOT EXISTS idx_tiktok_products_channel_kept
ON tiktok_channel_products(channel_id,inventory_status,last_seen_at DESC,id DESC);
