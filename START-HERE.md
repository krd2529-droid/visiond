# VisionD — จุดเริ่มต้นก่อนทำงาน

เวอร์ชันปัจจุบัน: **v0.14.327**

## ลำดับที่ต้องอ่าน

1. `VERSION.txt`
2. Patch ledger ล่าสุด: `patch-ledgers/v0.14.327.json`
3. Requirement ปัจจุบัน: `requirements-ledger.json`
4. Roadmap ปัจจุบัน: `work-history/visiond/roadmap/VISIOND-ROADMAP.md`
5. กติกาแพต: `work-history/visiond/protocols/JARVIS-PATCH-PROTOCOL.md`

## กฎความถูกต้อง

- เอกสารรุ่นใหม่มีสิทธิ์แทนที่ข้อมูลรุ่นเก่าเมื่อขัดแย้งกัน
- เอกสารใน `work-history/visiond/` เป็นตำแหน่งหลักสำหรับค้นย้อนหลังและ Regression
- ไฟล์เอกสารเก่าที่ค้างอยู่รากโครงการจากการแตก ZIP ทับ ให้รัน `npm run docs:migrate`
- บน Windows สามารถดับเบิลคลิก `APPLY-DOCUMENT-MIGRATION.cmd`
- ให้รัน `npm run docs:history-check` ก่อนส่งแพตถัดไป

## สถานะการย้าย

- Phase 1: คัดลอกและตรวจความตรงกัน — เสร็จใน v0.14.60
- Phase 2: เปลี่ยนจุดอ้างอิงและเก็บต้นฉบับออกอย่างปลอดภัย — เสร็จใน v0.14.61
- Safety hardening: ไฟล์เก่าที่เนื้อหาต่างจะถูกเก็บใน `legacy-versions/` ห้ามลบทิ้ง — v0.14.62
