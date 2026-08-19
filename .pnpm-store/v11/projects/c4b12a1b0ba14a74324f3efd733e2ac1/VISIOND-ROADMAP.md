# VisionD Active Roadmap

ไฟล์นี้เป็นคิวงานปัจจุบัน ไม่ใช่ประวัติและไม่ใช่คำสั่งให้ทำทุกหัวข้อ Codex ทำได้เฉพาะ `Active Patch` ที่ Boss อนุมัติ และห้ามเริ่ม `Next Queue` เอง

## Current Event Case

### GOV-UI-DESIGN-CONTRACT — ป้องกันธีมและปุ่มแตกเมื่อเพิ่มฟีเจอร์

- สถานะ: `IMPLEMENTED`
- เป้าหมาย: บังคับงาน Frontend/UI ใช้ canonical theme/button system และขออนุมัติก่อนสร้าง component ใหม่
- เสร็จแล้ว: `v0.14.335` UI Design Contract Protocol และ routing แบบ WHEN-TOUCHING

## Active Patch

### v0.14.335 — UI Design Contract Protocol

- เป้าหมายหลัก: ให้ฟีเจอร์ UI ใหม่รักษาธีมและปุ่มเดิมโดยไม่เพิ่มภาระให้แพตที่ไม่แตะ UI
- Acceptance: มี canonical sources, button/interaction/layout contracts, stop condition ก่อนสร้าง component ใหม่ และ focused evidence
- ห้ามเปลี่ยน: หน้าตา Production ปัจจุบัน, โค้ดธุรกิจ, API และ Database
- สถานะ: `IMPLEMENTED`

## Next Queue — ห้ามเริ่มเอง

- ยังไม่มีคิวถัดไปที่ Boss อนุมัติ

รายการนี้เป็นข้อเสนอคิว ไม่ใช่ Patch Scope จนกว่า Boss จะอนุมัติเลขแพตและขอบเขต

## Blocked / Waiting

- ไม่มี blocker ของแพต Active
- Push, Deploy และ Production Validation รอคำสั่ง Boss

## Recently Completed

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
