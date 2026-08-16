# VisionD Partner API Protocol

ต้นฉบับใช้งานอยู่ที่ `VISIOND-PARTNER-API-PROTOCOL.md`

- เว็บ 2 แยกฐานสมาชิกและออเดอร์จาก VisionD
- งานเว็บ 2 ทุกระยะรวมอยู่ที่ปุ่ม `ศูนย์ควบคุมเว็บพาร์ทเนอร์` จุดเดียว
- เชื่อมผ่าน Versioned API/Signed Event เท่านั้น
- Credential ต่อเว็บไซต์เข้ารหัส แสดงครั้งเดียว เพิกถอนได้ และใช้ Least Privilege Scope
- Phase 1 เปิด `products:read`; Phase 2 แยก `customers:write` และ `orders:write`
- งานเขียนต้องมี External ID และ `Idempotency-Key`; Key เดิมห้ามสร้างข้อมูลซ้ำ
- ห้ามรับ Password, Token เต็ม, ข้อมูลบัตร หรือข้อมูลธนาคาร และต้องเข้ารหัสข้อมูลระบุตัวลูกค้า
- Sandbox ต้องแยกจากข้อมูล Production และประวัติต้องปิดบัง Credential, ข้อมูลส่วนตัว, External ID และ Idempotency Key
- Signed Webhook ต้องตรวจ HMAC ของ Timestamp+Raw Body ภายใน 5 นาที ป้องกัน Signature/Idempotency ซ้ำ เข้ารหัส Payload คิว และปิดบัง Log
- Health Dashboard แยกแต่ละเว็บไซต์ แสดง Metrics 24 ชั่วโมงและแจ้ง Signature/Timestamp/Retry/Dead Letter โดยห้ามเปิดเผย Payload หรือข้อมูลส่วนตัว
- E2E Readiness ต้องตรวจสินค้าและวงจรธุรกรรมครบใน Sandbox พร้อม Idempotency, Webhook, Retry/Dead และ Alert โดยไม่เขียนข้อมูลทดสอบลง Production
