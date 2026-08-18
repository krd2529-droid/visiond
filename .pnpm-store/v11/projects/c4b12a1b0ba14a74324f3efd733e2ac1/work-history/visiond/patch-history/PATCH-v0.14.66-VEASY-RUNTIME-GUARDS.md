# PATCH v0.14.66 — V Easy Runtime Guards

## ทำแล้ว

- หนึ่งร้านถือ Runtime Lease ได้หนึ่ง App Session/เครื่อง พร้อม heartbeat 45 วินาที
- Lease หมดอายุถูกยึดคืนได้ ป้องกันร้านติดตายเมื่อแอปปิดผิดปกติ
- หนึ่งบทสนทนาถือ Conversation Lease ได้หนึ่ง Worker พร้อม heartbeat 30 วินาที
- Conversation Lease ใช้ได้ต่อเมื่อ Runtime Lease ของ Session และเครื่องเดียวกันยัง Active
- Message Claim ใช้ `(shop_id, platform_message_id)` กันตอบข้อความซ้ำ
- Order Claim ใช้ `(shop_id, idempotency_key)` กันสร้างออเดอร์ซ้ำ
- Token ของ Lease ทุกชนิดเก็บเฉพาะ SHA-256 hash
- Account Context แยกตาม user และรายการร้านถูก scope ด้วย Session owner
- Logout ส่งคำสั่งล้าง local state ของบัญชี ร้าน แชท ออเดอร์ และสินค้า

## ขอบเขต

แพตนี้ทำสัญญา API และระบบป้องกันฝั่ง VisionD ครบแล้ว ตัวแอป V Easy ต้องเรียก acquire/heartbeat/release และล้าง local state ตาม response เมื่อนำไฟล์แอปจริงมาเชื่อม

**EVENT CASE: เสร็จทั้งหมดแล้ว — พร้อมรับ Event Case ใหม่**
