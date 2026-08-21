# VisionD Active Roadmap

ไฟล์นี้เป็นคิวงานปัจจุบัน ไม่ใช่ประวัติและไม่ใช่คำสั่งให้ทำทุกหัวข้อ Codex ทำได้เฉพาะ `Active Patch` ที่ Boss อนุมัติ และห้ามเริ่ม `Next Queue` เอง

## Current Event Case

### V12-FACEBOOK-BOT-REPLY — Facebook Page รับข้อความแต่บอทไม่ตอบ

- สถานะ: `IMPLEMENTED` ใน v0.14.390; รอ Push/Deploy และ Production Validation
- Root cause: webhook เดิมบังคับทุก conversation เป็น `human` และไม่มี AI/send pipeline
- แก้แล้ว: แชทใหม่เริ่ม bot, รักษา human handoff เดิม, ตอบ text เมื่อ shop bot running และบันทึก reply/error

### FEATURE-MAP-COVERAGE — ไล่ Feature Map เทียบโค้ดจริงให้ครบก่อน Partner API/Web 2

- สถานะ: `IMPLEMENTED`; Coverage Audit รอบสุดท้ายผ่านใน v0.14.389
- เป้าหมาย: ลงทะเบียนระบบจริงทีละระบบด้วยรหัส `DOMAIN-CAPABILITY-NNN` โดยไม่เปลี่ยนพฤติกรรมธุรกิจ
- เสร็จแล้ว: `v0.14.387` V4 Card Actions Coverage; `v0.14.388` Partner API/Web 2 Feature Map; `v0.14.389` Final Coverage Audit
- ยังเหลือใน Event Case นี้: ไม่มี; Security ถูกจัดอยู่ใต้ `AUTH-ACCOUNT-001`

## Active Patch

### v0.14.410 — Payment-safe Entitlement Claim

- เป้าหมายหลัก: ส่งมอบสิทธิ์ Web 2 โดยยึด native paid order และ entitlement จริง ไม่มีช่องลัด paid
- Acceptance: Boss-only exact match, native order ห้าม reuse, encrypted+hashed 24h one-time claim, account-bound consume และไม่คืนไฟล์/object key
- ห้ามเปลี่ยน: native payment approval/grantOrder/download permission, `/orders/sync`, API 1 บาท, canonical UI theme และ deployment state
- สถานะ: `IMPLEMENTED`; migration 0068 และ runtime รอ E2E security/query-budget gate

## Next Queue — ห้ามเริ่มเอง

1. v0.14.411 Commerce E2E + Query Budget Production Gate: ทดสอบ create/replay/status/paid-match/wrong-account/consume/reuse และ bounded reads/writes ก่อนปิด implementation
2. Production Validation: ตรวจ D1 Query Insights/Rows read-written ของ V12 v0.14.405–406 เป็นเวลา 24 ชั่วโมง

รายการนี้เป็นข้อเสนอคิว ไม่ใช่ Patch Scope จนกว่า Boss จะอนุมัติเลขแพตและขอบเขต

## Blocked / Waiting

- ไม่มี blocker ของแพต Active
- Push, Deploy และ Production Validation รอคำสั่ง Boss
- `DISCOVERED`: migration chain ปัจจุบัน replay จากฐานว่างไม่ได้เพราะ `0001` มี `username` แต่ `0002` เพิ่มซ้ำ ต้องทำ rebaseline เป็นแพตแยกก่อนสร้าง environment ใหม่

## Recently Completed

- `v0.14.337` — Sales Page Center Feature Map
- `v0.14.336` — ELON Chat Feature Map
- `v0.14.335` — UI Design Contract Protocol
- `v0.14.334` — Automated Patch Gate ก่อน Commit
- `v0.14.333` — รายได้พาร์ตเนอร์ 50/50 ไม่หักค่า API และแสดงรอบเคลียร์วันที่ 1
- `v0.14.332` — หน้าแก้ไขตะกร้าคอร์สใช้วิดีโอ Multipart สูงสุด 2 GB
- `v0.14.330` — ย่อ Active Protocol และ routing เอกสารตามระบบ
- `v0.14.331` — ย่อ Roadmap Active เป็นคิวและเก็บประวัติแยก
- `v0.14.329` — จดจำจำนวนดาวน์โหลดรูปตัวอย่างต่อตะกร้า
- `v0.14.328` — ZIP รูปตัวอย่างเป็นโฟลเดอร์ชื่อตะกร้าและจำกัด 30 รูป
- `v0.14.327` — Feature Map ระบบ Vision 7

## Historical Sources — Reference Only

- Roadmap เดิม: `work-history/visiond/roadmap/VISIOND-ROADMAP.md`
- Patch History รายแพต: `work-history/visiond/patch-history/`
- Requirement snapshots: `requirements-history/`
- Feature ownership ปัจจุบัน: `FEATURE-MAP.md`

ประวัติใช้ค้น regression, root cause และ rollback เท่านั้น ห้ามนำสถานะหรือ sequencing เก่ามาขยายงาน Active

## Update Rule

- หนึ่งแพตแก้เฉพาะสถานะ Active และรายการล่าสุดที่เกี่ยวข้อง
- งานที่พบเพิ่มบันทึกเป็น `DISCOVERED` หรือเสนอใน Next Queue โดยไม่เริ่มเอง
- รายการเสร็จย้ายไป Patch History และคง Recently Completed เพียงไม่กี่รายการ
- สถานะ `IMPLEMENTED`, `PUSHED`, `DEPLOYED`, `PRODUCTION_VALIDATED` ต้องแยกกัน
