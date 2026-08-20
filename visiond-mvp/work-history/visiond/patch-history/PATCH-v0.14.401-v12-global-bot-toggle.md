# PATCH v0.14.401 — V12 Global Bot Toggle

## Scope

- เพิ่มปุ่มเปิด/ปิด V12 ทั้งร้านที่หัวหน้า V12 Connect
- อ่านสถานะจริงจาก `veasy_bot_state` ของร้านที่ผูก Facebook Page
- เปิดได้เมื่อ Facebook webhook, ร้าน และ AI Provider พร้อม
- ปิดแล้วยังรับและบันทึกข้อความ แต่ไม่เรียก AI ตอบลูกค้า
- ใช้ audit และล้าง runtime leases ตามสัญญา bot stop เดิม

## ไม่เปลี่ยน

- ปุ่ม `V12 รับช่วง` / `คืนให้บอท` รายบทสนทนา
- Facebook credential, HMAC webhook, message dedup และ inbox retention
- Button/theme system เดิม

## Verification

- Focused contract test ครอบคลุม UI, Boss API, readiness, start/stop, audit และ stopped ingest
- Visible version, regression และ predeploy ผ่าน patch gate

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
