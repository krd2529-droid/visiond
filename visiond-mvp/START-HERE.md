# VisionD — จุดเริ่มต้นก่อนทำงาน

เวอร์ชันปัจจุบัน: **v0.14.439**

## ลำดับที่ต้องอ่าน

1. `VERSION.txt`
2. กติกา Active: `JARVIS-PATCH-PROTOCOL.md`
3. Patch ledgerล่าสุด: `patch-ledgers/v0.14.439.json`

เอกสารอื่นโหลดตาม `WHEN-TOUCHING` เท่านั้น ไม่ต้องอ่าน Roadmap, Marketing Plan, Customer Data, Requirement ทั้งหมด หรือประวัติเก่าทุกแพต

เมื่อแตะ Frontend/UI ให้โหลด `VISIOND-UI-DESIGN-PROTOCOL.md` ตาม routing ใน Active Protocol

## กฎความถูกต้อง

- ใช้ลำดับอำนาจใน Active Protocol; คำสั่ง Boss และ Patch Scope ที่อนุมัติมีอำนาจเหนือ Roadmap/History
- เอกสารใน `work-history/visiond/` ใช้ค้นย้อนหลังและ Regression ไม่ใช่กติกา Active เว้นแต่ routing ระบุให้เปิดหัวข้อเฉพาะ
- ไฟล์เอกสารเก่าที่ค้างอยู่รากโครงการจากการแตก ZIP ทับ ให้รัน `npm run docs:migrate`
- บน Windows สามารถดับเบิลคลิก `APPLY-DOCUMENT-MIGRATION.cmd`
- ให้รัน `npm run docs:history-check` ก่อนส่งแพตถัดไป

## สถานะการย้าย

- Phase 1: คัดลอกและตรวจความตรงกัน — เสร็จใน v0.14.60
- Phase 2: เปลี่ยนจุดอ้างอิงและเก็บต้นฉบับออกอย่างปลอดภัย — เสร็จใน v0.14.61
- Safety hardening: ไฟล์เก่าที่เนื้อหาต่างจะถูกเก็บใน `legacy-versions/` ห้ามลบทิ้ง — v0.14.62
