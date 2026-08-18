# PATCH v0.14.221 — Partner API E2E Readiness

- เพิ่มปุ่ม “ทดสอบ E2E” ต่อเว็บไซต์ในศูนย์ควบคุมเว็บพาร์ทเนอร์
- ตรวจสินค้า Read-only ผ่าน Credential จริง แล้วจำลองลูกค้า ออเดอร์ ชำระเงิน ยกเลิก และคืนเงินใน Sandbox
- ตรวจ Idempotent Replay, Conflict, HMAC/Timestamp, Retry/Dead Letter และ Health Alert ในรอบเดียว
- ไม่เขียนลูกค้า/ออเดอร์ทดสอบลง Production และไม่ส่ง Credential, Signature หรือข้อมูลส่วนตัวกลับหน้าเว็บ
- เว็บไซต์ต้อง active และมี Scope `products:read`, `customers:write`, `orders:write` ครบก่อนเริ่มทดสอบ
