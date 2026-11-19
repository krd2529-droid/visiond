-- Apply only after migration 0146_auto_invite_monthly.sql and customer 1.7.4 QA.
-- Keep both offers draft until the verified 1.7.4 release and Worker are active.
UPDATE vision7_plans SET name='คีย์ตลอดชีพ · Windows 1 เครื่อง',price=1590,offer_price=159000,duration_days=NULL,updated_at=CURRENT_TIMESTAMP
  WHERE id=8 AND program_id=4 AND product_id=5497 AND plan_code='lifetime' AND price=690 AND offer_price=69000;
UPDATE products SET title='Follow me · คีย์ตลอดชีพ · Windows 1 เครื่อง',price=159000,status='draft',promotion_percent=0,updated_at=CURRENT_TIMESTAMP
  WHERE id=5497 AND slug='vbot-key-auto-invite-lifetime' AND source='vision7' AND product_kind='vision7-key' AND price=69000;
INSERT INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind)
  SELECT 'vbot-key-auto-invite-monthly','Follow me · คีย์ 30 วัน · Windows 1 เครื่อง',
    'คีย์ใช้งาน Follow me 30 วัน ผูกกับ Windows 1 เครื่อง',
    'รับคีย์หลังชำระเงินและระบุรหัสเครื่อง ใช้งาน 30 วันนับจากการรับคีย์ ต่ออายุด้วยการซื้อแพ็กเกจรายเดือนอีกครั้งบนเครื่องเดิม',
    59000,cover_url,preview_urls,'vbot-key','LICENSE',0,'draft','vision7','vision7-key'
  FROM products WHERE id=5497 AND slug='vbot-key-auto-invite-lifetime' AND price=159000
    AND NOT EXISTS (SELECT 1 FROM products WHERE slug='vbot-key-auto-invite-monthly' AND deleted_at IS NULL);
INSERT INTO vision7_plans(program_id,product_id,plan_code,name,price,duration_days,offer_price,active)
  SELECT 4,p.id,'monthly','คีย์ 30 วัน · Windows 1 เครื่อง',590,30,59000,1
  FROM products p WHERE p.slug='vbot-key-auto-invite-monthly' AND p.price=59000 AND p.status='draft'
    AND EXISTS (SELECT 1 FROM vision7_programs WHERE id=4 AND code='auto-invite')
    AND NOT EXISTS (SELECT 1 FROM vision7_plans WHERE program_id=4 AND plan_code='monthly');
