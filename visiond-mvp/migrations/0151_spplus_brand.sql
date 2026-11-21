-- Apply only after /assets/spplus-logo.png is live. Preserve SPLUS license identity and prices.
UPDATE vision7_programs
SET app_name='SP+',
    app_description='SP+ จัดการโปรไฟล์ Shopee Affiliate หลายบัญชี ดูยอดค่าคอมมิชชั่น และเปลี่ยนชื่อบัญชีบน Windows',
    cover_url='/assets/spplus-logo.png'
WHERE id=5 AND code='splus' AND app_name='S+' AND cover_url='/assets/splus-logo.png';

UPDATE products
SET title='SP+ · ตลอดชีพ · 30 บัญชี',
    cover_url='/assets/spplus-logo.png',preview_urls='["/assets/spplus-logo.png"]'
WHERE id=5514 AND slug='vbot-key-splus-accounts30' AND price=99000
  AND title='S+ · ตลอดชีพ · 30 บัญชี' AND cover_url='/assets/splus-logo.png'
  AND preview_urls='["/assets/splus-logo.png"]';

UPDATE products
SET title='SP+ · ตลอดชีพ · 50 บัญชี',
    cover_url='/assets/spplus-logo.png',preview_urls='["/assets/spplus-logo.png"]'
WHERE id=5515 AND slug='vbot-key-splus-accounts50' AND price=149000
  AND title='S+ · ตลอดชีพ · 50 บัญชี' AND cover_url='/assets/splus-logo.png'
  AND preview_urls='["/assets/splus-logo.png"]';

UPDATE products
SET title='SP+ · ตลอดชีพ · 100 บัญชี',
    cover_url='/assets/spplus-logo.png',preview_urls='["/assets/spplus-logo.png"]'
WHERE id=5516 AND slug='vbot-key-splus-accounts100' AND price=249000
  AND title='S+ · ตลอดชีพ · 100 บัญชี' AND cover_url='/assets/splus-logo.png'
  AND preview_urls='["/assets/splus-logo.png"]';
