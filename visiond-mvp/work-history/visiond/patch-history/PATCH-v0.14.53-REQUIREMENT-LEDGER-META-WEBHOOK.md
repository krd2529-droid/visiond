# VisionD v0.14.53 — Requirement Ledger + Secure Meta Webhook

วันที่: 2026-08-10

## ระบบกันงานหลุด

- เพิ่ม `requirements-ledger.json` ลงทะเบียนคำสั่ง Event Case เป็นรหัสแยก 20 รายการ
- เพิ่มสถานะ `DONE-VERIFIED`, `PENDING`, `BLOCKED`, `MISSING`, `UNCERTAIN`, `REMOVED-BY-BOSS`
- เพิ่ม Coverage Check ตรวจรหัสซ้ำ สถานะ หลักฐาน และไฟล์หลักฐานจริง
- `MISSING` หรือ `UNCERTAIN` ทำให้การตรวจล้มเหลว
- คำสั่งปิด Event Case จะล้มเหลวถ้ายังมีรายการนอกเหนือจาก `DONE-VERIFIED` หรือ `REMOVED-BY-BOSS`
- รอบ Integration/Regression ต้องย้อน Ledger ข้ามแพต ไม่ตรวจเพียงว่าเว็บเปิดได้

## Meta Messenger Webhook

- GET verification ด้วย `META_WEBHOOK_VERIFY_TOKEN`
- POST ตรวจ `X-Hub-Signature-256` ด้วย HMAC SHA-256 และ `META_APP_SECRET`
- จำกัด payload 1 MB และรับเฉพาะ Page events
- ตรวจ `META_PAGE_ID` ป้องกัน event ของเพจอื่น
- dedupe ด้วย message/event key แบบ Primary Key
- hash และ AES-GCM encrypt Meta participant ID; ไม่เก็บ ID ดิบ
- กรอง echo, sender ผิดปกติ และเก็บเฉพาะชนิดไฟล์แนบโดยไม่เก็บ URL จากภายนอก
- บันทึก webhook processing status เพื่อ audit/retry ภายหลัง
- เพิ่มตัวตรวจหน้าต่างตอบกลับ 24 ชั่วโมง แต่ยังคงสถานะ Requirement เป็น `PENDING` จนเชื่อม outbound sender จริง

## Production Secrets

- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `META_PAGE_ID`
- `META_DATA_ENCRYPTION_KEY` สุ่มอย่างน้อย 32 ตัวอักษรและห้ามเปลี่ยนหลังเริ่มเก็บข้อมูล

## Requirement Coverage

- คำสั่งทั้งหมด: 20
- DONE-VERIFIED: 14
- PENDING: 6
- MISSING: 0
- UNCERTAIN: 0

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
