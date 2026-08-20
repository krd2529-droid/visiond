# PATCH v0.14.390 — V12 Facebook Bot Reply

- Feature: `V12-INBOX-001`
- Root cause: Facebook webhook บังคับ conversation เป็น human และไม่มี AI reply/send pipeline
- แชทใหม่เริ่ม bot; แชทเดิมรักษา human handoff ที่ Boss เลือก
- ตอบเฉพาะ text เมื่อ shop bot running; image เก็บเข้า inbox โดยไม่เข้า AI
- Risk turn ส่งต่อ human; provider/Meta failure บันทึก claim และ bot last_error
- ไม่เปลี่ยน LINE, Broadcast, signature, credential, UI หรือ theme
- Focused: `scripts/test-v014390.mjs`
- Push/Deploy: ไม่ทำ
