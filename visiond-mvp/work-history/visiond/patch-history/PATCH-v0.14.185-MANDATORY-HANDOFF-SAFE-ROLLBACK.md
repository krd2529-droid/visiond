# PATCH v0.14.185 — MANDATORY HANDOFF + SAFE ROLLBACK

## 1. แก้อะไร

- บังคับ Patch Handoff 5 ข้อทุกแพตช์ และแยกสถานะ Implemented/Push/Deploy/Production validated
- เพิ่ม Safe Baseline ที่อ้างอิงหลักฐานจริง แยกจาก parent commit และ candidate ล่าสุด
- กำหนดการย้อนด้วย `git revert` โดยไม่ Reset ไม่วางไฟล์เก่าทับ และไม่ Push/Deploy อัตโนมัติ

## 2. แก้ไฟล์ใด

- Protocol, Roadmap, `SAFE-BASELINE.md`, Patch Ledger, Patch History, VERSION และชุดทดสอบ v0.14.185

## 3. ทดสอบอะไรและผลเป็นอย่างไร

- ดู `patch-ledgers/v0.14.185.json` และผล QA ใน Commit/รายงานส่งมอบ

## 4. Commit identity

- Ledger: `SELF`
- Resolve: `git log -1 --format=%H -- visiond-mvp/patch-ledgers/v0.14.185.json`
- Parent commit: `288cd0f`

## 5. วิธีย้อนกลับ

- Safe rollback commit: `5ea8741` (`v0.14.182`, Production validated)
- ย้อนแพตช์นี้ด้วย `git revert <resolved-commit-id>` แล้วรัน regression/predeploy/security/version checks
- Boss เป็นผู้ Push และ Deploy เท่านั้น
