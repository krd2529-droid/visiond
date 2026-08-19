# VisionD Active Roadmap

ไฟล์นี้เป็นคิวงานปัจจุบัน ไม่ใช่ประวัติและไม่ใช่คำสั่งให้ทำทุกหัวข้อ Codex ทำได้เฉพาะ `Active Patch` ที่ Boss อนุมัติ และห้ามเริ่ม `Next Queue` เอง

## Current Event Case

### FEATURE-MAP-COVERAGE — ไล่ Feature Map เทียบโค้ดจริงให้ครบก่อน Partner API/Web 2

- สถานะ: `IN PROGRESS`
- เป้าหมาย: ลงทะเบียนระบบจริงทีละระบบด้วยรหัส `DOMAIN-CAPABILITY-NNN` โดยไม่เปลี่ยนพฤติกรรมธุรกิจ
- เสร็จแล้ว: `v0.14.336` ELON Chat; `v0.14.337` Sales Page Center; `v0.14.338` Vision 13 Intake; `v0.14.339` Vision 14 Library
- ยังเหลือ: Vision 14 Summary/MIX, Ads/Analytics, Webhook Hub, Security, Partner API/Web 2 และระบบที่ Coverage Audit รอบสุดท้ายพบ

## Active Patch

### v0.14.339 — Vision 14 Library Feature Map

- เป้าหมายหลัก: ลงทะเบียนคลังต้นฉบับ PDF, rights gate และการ extract/OCR รายหน้า
- Acceptance: Map อ้าง R2/schema/rights/cleanup/OCR จริง และหน้า Library มีรหัส `V14-LIBRARY-001`
- ห้ามเปลี่ยน: file limit, rights gate, extraction/OCR contract, API และ UI behavior
- สถานะ: `IMPLEMENTED`

## Next Queue — ห้ามเริ่มเอง

1. ระบบถัดไปจาก Coverage Audit ที่ยังไม่มีรหัส โดยต้องตรวจหลักฐานก่อนเลือกในแพตถัดไป

รายการนี้เป็นข้อเสนอคิว ไม่ใช่ Patch Scope จนกว่า Boss จะอนุมัติเลขแพตและขอบเขต

## Blocked / Waiting

- ไม่มี blocker ของแพต Active
- Push, Deploy และ Production Validation รอคำสั่ง Boss

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
