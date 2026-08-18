# PATCH v0.14.186 — EVENT CASE COMPLETION GUARD

## 1. แก้อะไร

- กำหนดงานที่ Boss สั่ง 1 เรื่องเป็น 1 Event Case
- ถ้าหนึ่งแพตช์หรือหนึ่งรอบยังทำไม่ครบ ต้องแจ้ง `EVENT CASE: ยังไม่เสร็จ — ต้องทำต่อให้จบ`
- ต้องระบุรายการที่เหลือ สถานะ/ตัวขวาง และงานถัดไป ก่อนเริ่มเรื่องอื่น
- หาก Boss สั่งพัก ให้ใช้ `PAUSED BY BOSS` โดยไม่ปิดเคสเท็จ

## 2. แก้ไฟล์ใด

- JARVIS Patch Protocol ทุกสำเนา, Patch Handoff Template, Roadmap, Version และ test v0.14.186

## 3. ผลทดสอบ

- ดู `patch-ledgers/v0.14.186.json`

## 4. Commit identity

- Ledger: `SELF`; Parent: `ac38c51`

## 5. วิธีย้อนกลับ

- `git revert SELF` หลัง resolve Commit ID; Safe baseline `5ea8741`; Boss Push/Deploy เท่านั้น
