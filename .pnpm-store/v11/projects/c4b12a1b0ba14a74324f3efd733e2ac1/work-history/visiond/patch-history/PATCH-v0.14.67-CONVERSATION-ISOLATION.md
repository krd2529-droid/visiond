# PATCH v0.14.67 — Conversation Isolation QA

## บั๊กที่ตรวจพบและแก้แล้ว

Runtime v0.14.66 ล็อก Worker ตามร้านแล้ว แต่ยังไม่บังคับให้ `conversation_id` ถูกลงทะเบียนเป็นของร้านก่อนขอ Conversation Lease หากตัวแอปส่งรหัสผิด อาจเกิดการอ้างแชทข้ามร้านในชั้นประมวลผลได้

## การแก้ไข

- เพิ่มทะเบียน `veasy_conversations` แยกด้วย Primary Key `(shop_id, id)`
- ลูกค้าแพลตฟอร์มหนึ่งรายไม่ซ้ำภายในร้าน แต่สามารถทักหลายร้านได้อย่างถูกต้อง
- เก็บ Platform Participant ID เป็น SHA-256 hash และไม่คืน hash ออกจาก API
- ลงทะเบียนบทสนทนาได้เฉพาะ App Session ที่ถือ Runtime Lease ของร้าน
- ตรวจความขัดแย้งเมื่อ Conversation ID เดิมถูกส่งมากับลูกค้าคนอื่น
- Conversation Lease ออกได้เฉพาะบทสนทนาสถานะ Active ที่อยู่ในร้านเดียวกัน
- Message/Order Claim ยังคงต้องถือ Conversation Lease ที่ผ่านสายเจ้าของครบ

**EVENT CASE: เสร็จทั้งหมดแล้ว — พร้อมรับ Event Case ใหม่**
