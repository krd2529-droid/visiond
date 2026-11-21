-- S+ remains inactive/draft until the signed customer installer and account gates pass.
INSERT OR IGNORE INTO vision7_programs
  (code,app_name,app_description,cover_url,platform_type,current_version,minimum_version,requires_online,max_devices,trial_hours,active)
VALUES('splus','S+','จัดการโปรไฟล์ Shopee Affiliate แยกบัญชี ดูยอดค่าคอมมิชชั่น และเปลี่ยนชื่อบัญชีบน Windows','/assets/splus-logo.png','windows','1.0.0','1.0.0',0,1,72,0);

INSERT OR IGNORE INTO vision7_plans(program_id,plan_code,name,price,offer_price,duration_days,active)
SELECT id,'accounts30','ตลอดชีพ · 30 บัญชี',990,99000,NULL,1 FROM vision7_programs WHERE code='splus';
INSERT OR IGNORE INTO vision7_plans(program_id,plan_code,name,price,offer_price,duration_days,active)
SELECT id,'accounts50','ตลอดชีพ · 50 บัญชี',1490,149000,NULL,1 FROM vision7_programs WHERE code='splus';
INSERT OR IGNORE INTO vision7_plans(program_id,plan_code,name,price,offer_price,duration_days,active)
SELECT id,'accounts100','ตลอดชีพ · 100 บัญชี',2490,249000,NULL,1 FROM vision7_programs WHERE code='splus';

INSERT OR IGNORE INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind)
VALUES('vbot-key-splus-accounts30','S+ · ตลอดชีพ · 30 บัญชี','จัดการโปรไฟล์ Shopee Affiliate และดูยอดค่าคอมมิชชั่น','คีย์ผูก Windows 1 เครื่อง จัดการโปรไฟล์ Shopee Affiliate พร้อมกันสูงสุด 30 บัญชี ดูยอดค่าคอมมิชชั่น และเปลี่ยนชื่อบัญชี',99000,'/assets/splus-logo.png','["/assets/splus-logo.png"]','vbot-key','LICENSE',0,'draft','vision7','vision7-key');
INSERT OR IGNORE INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind)
VALUES('vbot-key-splus-accounts50','S+ · ตลอดชีพ · 50 บัญชี','จัดการโปรไฟล์ Shopee Affiliate และดูยอดค่าคอมมิชชั่น','คีย์ผูก Windows 1 เครื่อง จัดการโปรไฟล์ Shopee Affiliate พร้อมกันสูงสุด 50 บัญชี ดูยอดค่าคอมมิชชั่น และเปลี่ยนชื่อบัญชี',149000,'/assets/splus-logo.png','["/assets/splus-logo.png"]','vbot-key','LICENSE',0,'draft','vision7','vision7-key');
INSERT OR IGNORE INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind)
VALUES('vbot-key-splus-accounts100','S+ · ตลอดชีพ · 100 บัญชี','จัดการโปรไฟล์ Shopee Affiliate และดูยอดค่าคอมมิชชั่น','คีย์ผูก Windows 1 เครื่อง จัดการโปรไฟล์ Shopee Affiliate พร้อมกันสูงสุด 100 บัญชี ดูยอดค่าคอมมิชชั่น และเปลี่ยนชื่อบัญชี',249000,'/assets/splus-logo.png','["/assets/splus-logo.png"]','vbot-key','LICENSE',0,'draft','vision7','vision7-key');

UPDATE vision7_plans SET product_id=(SELECT id FROM products WHERE slug='vbot-key-splus-'||vision7_plans.plan_code)
WHERE program_id=(SELECT id FROM vision7_programs WHERE code='splus') AND plan_code IN ('accounts30','accounts50','accounts100') AND product_id IS NULL;

CREATE TABLE IF NOT EXISTS splus_issues (
  order_item_id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL,user_id INTEGER NOT NULL,program_id INTEGER NOT NULL,
  machine_id TEXT NOT NULL,tier INTEGER NOT NULL CHECK(tier IN (30,50,100)),
  key_ciphertext TEXT NOT NULL DEFAULT '',key_last4 TEXT NOT NULL DEFAULT '',issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_item_id) REFERENCES order_items(id),FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(program_id) REFERENCES vision7_programs(id)
);
CREATE INDEX IF NOT EXISTS idx_splus_issues_user ON splus_issues(user_id,order_item_id DESC);
CREATE INDEX IF NOT EXISTS idx_splus_order_items_order_id_desc ON order_items(order_id,id DESC);

CREATE TABLE IF NOT EXISTS splus_trials (
  id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL UNIQUE,machine_id TEXT NOT NULL UNIQUE,program_id INTEGER NOT NULL,
  key_ciphertext TEXT NOT NULL DEFAULT '',key_hash TEXT NOT NULL DEFAULT '',key_last4 TEXT NOT NULL DEFAULT '',
  issued_at TEXT NOT NULL,expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(program_id) REFERENCES vision7_programs(id)
);
CREATE INDEX IF NOT EXISTS idx_splus_trials_program_user ON splus_trials(program_id,user_id);

CREATE TABLE IF NOT EXISTS splus_owner_grants (
  id INTEGER PRIMARY KEY,recipient_id INTEGER NOT NULL,issuer_id INTEGER NOT NULL,machine_id TEXT NOT NULL UNIQUE,
  key_ciphertext TEXT NOT NULL DEFAULT '',key_last4 TEXT NOT NULL DEFAULT '',issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(recipient_id) REFERENCES users(id),FOREIGN KEY(issuer_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_splus_owner_recipient ON splus_owner_grants(recipient_id,id DESC);
