CREATE INDEX IF NOT EXISTS idx_vision4_pending_preview_1
ON vision4_pending_files(json_extract(preview_urls,'$[0]'))
WHERE status='waiting_bundle' AND json_valid(preview_urls);

CREATE INDEX IF NOT EXISTS idx_vision4_pending_preview_2
ON vision4_pending_files(json_extract(preview_urls,'$[1]'))
WHERE status='waiting_bundle' AND json_valid(preview_urls);

CREATE INDEX IF NOT EXISTS idx_vision4_pending_preview_3
ON vision4_pending_files(json_extract(preview_urls,'$[2]'))
WHERE status='waiting_bundle' AND json_valid(preview_urls);

CREATE INDEX IF NOT EXISTS idx_products_normalized_title
ON products(lower(trim(title)));

CREATE INDEX IF NOT EXISTS idx_categories_public_order
ON categories(active,sort_order,id);

CREATE INDEX IF NOT EXISTS idx_products_slug_nocase
ON products(slug COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_product_slug_history_old_nocase
ON product_slug_history(old_slug COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_v12_active_conversations_updated
ON veasy_conversations(updated_at DESC,shop_id,id)
WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_v12_active_conversations_platform_updated
ON veasy_conversations(platform,updated_at DESC,shop_id,id)
WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_v12_messages_conversation_latest
ON veasy_chat_messages(shop_id,conversation_id,created_at DESC,id DESC);
