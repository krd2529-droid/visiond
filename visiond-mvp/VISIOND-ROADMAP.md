# VisionD Active Roadmap

ไฟล์นี้เป็นคิวงานปัจจุบัน ไม่ใช่ประวัติและไม่ใช่คำสั่งให้ทำทุกหัวข้อ Codex ทำได้เฉพาะ `Active Patch` ที่ Boss อนุมัติ และห้ามเริ่ม `Next Queue` เอง

## Current Event Case

### GOV-LEAN-WORKFLOW — ลดภาระกฎและทำให้แต่ละแพตรันครบ

- สถานะ: `IN PROGRESS`
- เป้าหมาย: แยกกฎ Active, Roadmap queue และ Automated Gate ออกจากกัน
- เสร็จแล้ว: `v0.14.330` Lean Active Patch Protocol
- กำลังทำ: `v0.14.331` Active Roadmap Queue
- ยังเหลือ: Automated Patch Gate เป็นแพตแยกหลัง Boss อนุมัติ

## Active Patch

### v0.14.331 — Active Roadmap Queue

- เป้าหมายหลัก: ให้ Roadmap รากแสดงเฉพาะ Current Event Case, Active Patch, Next Queue, Blocked และ Recently Completed
- Acceptance: Roadmap Active สั้นกว่า 100 บรรทัด; ไม่บรรจุ Patch History จำนวนมาก; ชี้ตำแหน่งประวัติครบ; tests เดิมยังผ่าน
- ห้ามเปลี่ยน: โค้ดธุรกิจ, API, Database, Feature behavior, Marketing Plan และไฟล์ Roadmap ประวัติ
- สถานะ: `IMPLEMENTED`

## Next Queue — ห้ามเริ่มเอง

1. Automated Patch Gate — รวม focused test, version, staged-file, regression และ predeploy checks เป็นคำสั่งเดียว

รายการนี้เป็นข้อเสนอคิว ไม่ใช่ Patch Scope จนกว่า Boss จะอนุมัติเลขแพตและขอบเขต

## Blocked / Waiting

- ไม่มี blocker ของแพต Active
- Push, Deploy และ Production Validation รอคำสั่ง Boss

## Recently Completed

- `v0.14.330` — ย่อ Active Protocol และ routing เอกสารตามระบบ
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
