-- Apply only after Worker deployment, 1.7.4 R2 readback, release 8 update and QA.
UPDATE products SET status='published',updated_at=CURRENT_TIMESTAMP
  WHERE id=5497 AND slug='vbot-key-auto-invite-lifetime' AND price=159000 AND status='draft'
    AND EXISTS (SELECT 1 FROM vision7_plans WHERE id=8 AND program_id=4 AND product_id=5497 AND plan_code='lifetime' AND offer_price=159000)
    AND EXISTS (SELECT 1 FROM vision7_releases WHERE program_id=4 AND version='1.7.4' AND status='published');
UPDATE products SET status='published',updated_at=CURRENT_TIMESTAMP
  WHERE slug='vbot-key-auto-invite-monthly' AND price=59000 AND status='draft'
    AND EXISTS (SELECT 1 FROM vision7_plans WHERE program_id=4 AND product_id=products.id AND plan_code='monthly' AND offer_price=59000)
    AND EXISTS (SELECT 1 FROM vision7_releases WHERE program_id=4 AND version='1.7.4' AND status='published');
