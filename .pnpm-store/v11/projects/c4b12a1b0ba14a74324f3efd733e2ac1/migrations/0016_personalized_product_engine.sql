-- v0.14.49 uses the existing privacy-minimized customer_events stream.
-- No new PII table is required. Interest profiles are derived on demand from the last 30 days.
CREATE INDEX IF NOT EXISTS idx_customer_events_interest ON customer_events(visitor_key,user_id,event_type,created_at DESC,product_id);
