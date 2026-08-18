# PATCH v0.14.218 — Partner API Phase 4 Signed Webhook

- Signed Webhook สำหรับลูกค้า ออเดอร์ ชำระเงิน ยกเลิก และคืนเงิน
- HMAC-SHA256, Timestamp 5 นาที, constant-time compare, Signature Replay และ Idempotency Protection
- Payload Queue เข้ารหัส AES-GCM พร้อม Retry แบบ exponential backoff และ Dead Letter หลัง 5 ครั้ง
- Queue/Log ปิดบังข้อมูลและควบคุมในศูนย์ควบคุมเว็บพาร์ทเนอร์
- Rollback ด้วย `git revert` Commit ของแพตนี้; ห้าม Push/Deploy ใน Event Case นี้
