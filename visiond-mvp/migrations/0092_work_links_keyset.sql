CREATE INDEX IF NOT EXISTS idx_admin_work_links_updated_id
ON admin_work_links(updated_at DESC,id DESC);
