# Patch v0.14.163 — V Easy LINE AI Reply

- LINE Verify ที่สำเร็จจะบันทึกช่องทางร้านเป็น `connected`
- Webhook ตอบ `200` ก่อน แล้วประมวลผลข้อความใน background
- รับเฉพาะข้อความ text ขณะบอทอยู่สถานะ `running`
- ดึงเฉพาะสินค้าของร้านนั้น ส่งให้ AI และตอบผ่าน LINE Reply API
- ใช้ message claim และ webhook event ID ป้องกัน redelivery ตอบซ้ำ
- เก็บข้อความแยก `shop_id + conversation_id` เพื่อไม่ให้ข้อมูลข้ามร้าน
- รองรับ `VEASY_OPENAI_API_KEY` / `VEASY_GEMINI_API_KEY` และ key กลางที่ระบบมีอยู่

## Event case

ยังไม่ปิดเคสจนกว่าจะ Deploy 0.14.163, กดทดสอบ LINE ใน V Easy อีกครั้ง, เปิดบอท และส่งข้อความจริงจาก LINE 1 ข้อความ
