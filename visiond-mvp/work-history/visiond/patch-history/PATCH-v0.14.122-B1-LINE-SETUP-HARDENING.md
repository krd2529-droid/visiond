# PATCH v0.14.122 — B1 LINE Setup Hardening

- เพิ่ม `VISIOND_CHANNEL_ENCRYPTION_KEY` เป็น Required item ใน Boss System Health เพื่อพบปัญหาก่อนลูกค้ากรอก LINE
- LINE status API ระบุ setup requirement แบบไม่เปิดเผยค่า Secret
- Save/Test ตอบ error code ที่แก้ได้จริง และยืนยันว่าไม่ต้องออก LINE Token ใหม่
- ความล้มเหลวไม่สร้าง Webhook ครึ่งรายการและไม่ส่ง Secret/Token กลับอุปกรณ์
- `wrangler.toml.example` บันทึก Secret ที่ต้องตั้งถาวรและห้ามเปลี่ยนหลังเริ่มใช้งาน

ขั้นตอน production: Cloudflare Workers & Pages → visiondonline → Settings → Variables and Secrets → เพิ่ม Secret `VISIOND_CHANNEL_ENCRYPTION_KEY` อย่างน้อย 32 ตัวอักษร → Redeploy → ตรวจ Boss System Health → บันทึก LINE ใน V Easy

EVENT CASE: ยังไม่เสร็จ — ต้อง Deploy เว็บก่อน แล้วทดสอบ Save → Test → Copy Webhook → LINE Verify บน Redmi ด้วยบัญชีจริง
