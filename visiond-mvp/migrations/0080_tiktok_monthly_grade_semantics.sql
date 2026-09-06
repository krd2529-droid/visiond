-- Align existing shortlist products with the A-F semantics introduced in v0.20.49.
-- Only user-selected three-day test entries are migrated; measured sales grades stay intact.
UPDATE tiktok_channel_products
SET product_type = 'D'
WHERE product_type = 'C'
  AND inventory_status = 'kept'
  AND review_cycle_days = 3
  AND source_kind IN ('manual_selection', 'marketplace_selection', 'sold_product_selection');

UPDATE tiktok_channel_products
SET review_cycle_days = 30,
    next_review_at = datetime(COALESCE(review_started_at, CURRENT_TIMESTAMP), '+30 days'),
    review_status = 'scheduled'
WHERE product_type IN ('A', 'B', 'C')
  AND inventory_status = 'kept';

UPDATE tiktok_channel_products
SET review_cycle_days = 3,
    next_review_at = datetime(COALESCE(review_started_at, CURRENT_TIMESTAMP), '+3 days'),
    review_status = 'scheduled'
WHERE product_type = 'D'
  AND inventory_status = 'kept';
