-- VisionD v0.4: บทบาทสมาชิก 3 ระดับ
-- boss  = เจ้าของระบบ สิทธิ์สูงสุด
-- admin = ผู้ดูแลสินค้า ออเดอร์ สลิป และสมาชิกทั่วไป
-- user  = ลูกค้าที่สมัครผ่านหน้าเว็บ

UPDATE users SET role='user' WHERE role IS NULL OR role='' OR role='customer';
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- หลังรัน migration ให้เปลี่ยนอีเมลเจ้าของระบบเป็น Boss ด้วยคำสั่งนี้
-- UPDATE users SET role='boss' WHERE lower(email)=lower('อีเมลเจ้าของระบบ');
