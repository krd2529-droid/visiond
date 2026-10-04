CREATE TABLE IF NOT EXISTS vpage_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  source_order_item_id INTEGER NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','consumed')),
  service_days INTEGER NOT NULL DEFAULT 30 CHECK(service_days=30),
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_vpage_credits_owner_cursor
ON vpage_credits(user_id,id DESC);

CREATE INDEX IF NOT EXISTS idx_vpage_credits_owner_status
ON vpage_credits(user_id,status);

INSERT INTO products(
  slug,title,short_description,description,price,cover_url,preview_urls,
  category,file_type,pages,status,source,product_kind
)
VALUES(
  'vpage-credit','Vpage Credit · Sales Page 30 วัน',
  '1 เครดิตสำหรับสร้าง Sales Page 1 หน้า พร้อมอายุบริการ 30 วัน',
  'ซื้อเครดิตผ่านระบบชำระเงิน VisionD เดิม เครดิตจะเข้าบัญชีหลังสลิปได้รับอนุมัติ การสร้างและตั้งค่า Vpage จะเปิดในขั้นตอนถัดไป',
  99900,'','[]','vpage-credit','เครดิตบริการ',0,'published','vpage','vpage-credit'
)
ON CONFLICT(slug) DO UPDATE SET
  title=excluded.title,
  short_description=excluded.short_description,
  description=excluded.description,
  price=99900,
  category='vpage-credit',
  file_type='เครดิตบริการ',
  status='published',
  source='vpage',
  product_kind='vpage-credit',
  updated_at=CURRENT_TIMESTAMP;
