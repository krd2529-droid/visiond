# QA v0.14.66 — V Easy Runtime Guards

- ตรวจ Primary Key ทำให้หนึ่งร้านมี Runtime Lease เดียว
- ตรวจ Primary Key ทำให้หนึ่งร้าน/หนึ่งบทสนทนามี Conversation Lease เดียว
- ตรวจ App Session, Device Hash, Account owner และ Shop owner ทุกชั้น
- ตรวจ Lease token เก็บเฉพาะ hash และมี expiry/reclaim
- ตรวจ Message ID และ Order Idempotency Key ซ้ำถูกตอบเป็น duplicate
- ตรวจ Claim ต้องมี Conversation Lease ที่ยัง Active
- ตรวจ Account Scope และคำสั่งล้าง local state เมื่อ Logout/สลับบัญชี
- ตรวจ Requirement Ledger ทั้ง Event Case ต้องไม่มี PENDING, MISSING หรือ UNCERTAIN

## ผลตรวจจริงก่อนแพ็ก

- Patch Test v0.14.66: ผ่าน `16/16`
- Regression: ผ่าน `31/31`
- Patch Coverage: `6/6`, pending `0`, missing `0`, uncertain `0`
- Source-to-Ledger: `27/27`, missing `0`
- Requirement Coverage: verified `27/27`, pending `0`, missing `0`, uncertain `0`
- Requirement Layer 2: snapshots `8`, verified `27/27`, missing `0`, uncertain `0`
- JavaScript Syntax: ผ่านทั้งหมด
- Predeploy: PASS `8`, WARN `8`, FAIL `0`

คำเตือน Predeploy เป็นค่า Environment ตัวอย่างและ asset cache version เดิม ไม่ใช่บั๊กที่บล็อกแพตนี้

Message/Order Claim ที่อยู่สถานะ processing จะไม่ถูก retry อัตโนมัติ เพื่อยึดหลักไม่ตอบหรือสร้างออเดอร์ซ้ำเมื่อไม่ทราบแน่ชัดว่างานเดิมทำ Side Effect สำเร็จแล้วหรือไม่
