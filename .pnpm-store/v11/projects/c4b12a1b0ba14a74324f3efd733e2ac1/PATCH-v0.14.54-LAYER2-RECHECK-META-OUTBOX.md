# VisionD v0.14.54 — Anti-Drop Layer 2 + Meta Outbox

## ตัวกันงานหลุดชั้นที่ 2

- ล็อก Snapshot ของ Ledger แต่ละแพตด้วย SHA-256
- ตรวจย้อนว่ารหัส Requirement จากแพตก่อนยังอยู่ครบ
- ตรวจ Snapshot ถูกแก้ย้อนหลังหรือไม่
- ตรวจข้อความ Requirement ถูกเปลี่ยนโดยไม่มีเหตุผลหรือไม่
- ตรวจงานที่เคย DONE ถูกลดสถานะโดยไม่มี `reopened_reason` หรือไม่
- ตรวจไฟล์หลักฐานจากแพตก่อนยังอยู่จริง
- ต้องผ่านทั้งชั้น 1 และชั้น 2 ก่อนส่ง ZIP

## ELON Page outbound

- เพิ่มคิวส่งข้อความแบบ idempotent
- บังคับกรอบ Meta 24 ชั่วโมงทั้งตอนเข้าคิวและก่อนส่งจริง
- `META_PAGE_ACCESS_TOKEN` อ่านจาก Cloudflare Secret เท่านั้น ไม่บันทึกใน D1 หรือไฟล์
- บังคับกำหนด Graph API version ผ่าน config เพื่อไม่ผูกระบบกับเวอร์ชันที่อาจหมดอายุ
- Retry ที่ 1, 5, 30, 120 และ 720 นาที ก่อนเปลี่ยนเป็น dead-letter
- Admin/Boss ส่งผ่าน API ที่ตรวจสิทธิ์ และมี Idempotency Key
- Cron retry endpoint ป้องกันด้วย Secret อย่างน้อย 32 ตัวอักษร

## Requirement Coverage

- Total: 20
- DONE-VERIFIED: 16
- PENDING: 4
- MISSING: 0
- UNCERTAIN: 0

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
