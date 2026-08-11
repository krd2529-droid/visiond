# v0.14.77 — ELON Database Hard Split

- `ELON_WEB_DB` เก็บเฉพาะบทสนทนา Rate limit Usage และ Retention ของ ELON Web
- `ELON_V7_DB` เป็นฐานกายภาพอีกตัวสำหรับ ELON V7 และจะออกแบบตารางงานเพจใน Event Case ภายหลัง
- ELON Web ใช้ Conversation ID ขึ้นต้น `ew_`
- ไม่มี fallback จาก ELON Web ไป `DB` หรือ `ELON_V7_DB`
- ฐาน VisionD หลักยังเป็นเจ้าของสมาชิก สินค้า ออเดอร์และสิทธิ์ แต่ไม่สร้างตาราง runtime ของ ELON Web ใหม่แล้ว
- ข้อมูล ELON เดิมไม่ถูกลบ และต้องเก็บไว้จนกว่าการตรวจย้ายข้อมูลจะเสร็จ
