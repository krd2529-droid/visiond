# PATCH v0.14.223 — Web 2 Integration Starter Kit

- เพิ่ม Client SDK สำหรับ Backend เว็บ 2 เพื่ออ่านสินค้า ซิงก์ลูกค้า/ออเดอร์ และส่ง Signed Event
- มีตัวสร้าง Request ID/Idempotency Key, ตัวตรวจ HTTPS Config และตัวปฏิเสธ Sensitive Payload ก่อนส่ง
- Credential อยู่ใน Private Class Field และ `.env.example` ใช้ Placeholder เท่านั้น
- เพิ่ม README พร้อมกฎห้ามนำ SDK/Credential เข้า Frontend bundle
- Security Gate ครอบคลุม Starter Kit และตัวอย่างทั้งหมด
