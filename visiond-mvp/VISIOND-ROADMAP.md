# VisionD Active Roadmap

ไฟล์นี้เป็นคิวงานปัจจุบัน ไม่ใช่ประวัติและไม่ใช่คำสั่งให้ทำทุกหัวข้อ Codex ทำได้เฉพาะ `Active Patch` ที่ Boss อนุมัติ และห้ามเริ่ม `Next Queue` เอง

## Current Event Case

### GOV-LEAN-WORKFLOW — ลดภาระกฎและทำให้แต่ละแพตรันครบ

- สถานะ: `IMPLEMENTED`
- เป้าหมาย: แยกกฎ Active, Roadmap queue และ Automated Gate ออกจากกัน
- เสร็จแล้ว: `v0.14.330` Lean Active Patch Protocol
- เสร็จแล้ว: `v0.14.331` Active Roadmap Queue
- เสร็จแล้ว: `v0.14.334` Automated Patch Gate

## Active Patch

### v0.14.334 — Automated Patch Gate

- เป้าหมายหลัก: รวม staged-file, focused, visible-version, regression และ predeploy checks เป็นคำสั่งเดียวก่อน Commit
- Acceptance: Gate หยุดเมื่อไม่มี staged files หรือพบไฟล์ต้องห้าม; ทุก check รันตามลำดับและ fail-fast; ไม่ Push/Deploy
- ห้ามเปลี่ยน: โค้ดธุรกิจ, API, Database และพฤติกรรม Production
- สถานะ: `IMPLEMENTED`

## Next Queue — ห้ามเริ่มเอง

- ยังไม่มีคิวถัดไปที่ Boss อนุมัติ

รายการนี้เป็นข้อเสนอคิว ไม่ใช่ Patch Scope จนกว่า Boss จะอนุมัติเลขแพตและขอบเขต

## Blocked / Waiting

- ไม่มี blocker ของแพต Active
- Push, Deploy และ Production Validation รอคำสั่ง Boss

## Recently Completed

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
