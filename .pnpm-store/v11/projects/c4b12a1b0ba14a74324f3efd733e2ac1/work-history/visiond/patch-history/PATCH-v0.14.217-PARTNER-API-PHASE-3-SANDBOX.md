# PATCH v0.14.217 — Partner API Phase 3 Sandbox

- Sandbox จำลองลูกค้า ออเดอร์ ชำระเงิน ยกเลิก และคืนเงินในศูนย์ควบคุมเว็บพาร์ทเนอร์
- ตรวจ Scope, External ID, Idempotency Replay และ Conflict โดยไม่เขียนข้อมูล Production
- ประวัติ Request/Response ปิดบัง Credential, ข้อมูลส่วนตัว, External ID และ Idempotency Key
- รองรับหน้าจอมือถือและใช้มาตรฐานปุ่ม VisionD
- Rollback ด้วย `git revert` Commit ของแพตนี้; ห้าม Push/Deploy ใน Event Case นี้
