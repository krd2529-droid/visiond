# VisionD — จุดเริ่มต้นก่อนทำงาน

เวอร์ชันปัจจุบัน: **v0.14.60**

## ลำดับที่ต้องอ่าน

1. `VERSION.txt`
2. PATCH ล่าสุด: `work-history/visiond/patch-history/PATCH-v0.14.60-DOCUMENT-HISTORY-PHASE1.md`
3. Requirement ปัจจุบัน: `requirements-ledger.json`
4. Roadmap ปัจจุบัน: `VISIOND-ROADMAP.md`
5. กติกาแพต: `JARVIS-PATCH-PROTOCOL.md`

## กฎความถูกต้อง

- เอกสารรุ่นใหม่มีสิทธิ์แทนที่ข้อมูลรุ่นเก่าเมื่อขัดแย้งกัน
- เอกสารใน `work-history/visiond/` เป็นสำเนาจัดหมวดสำหรับค้นย้อนหลังและ Regression
- ระยะที่ 1 ยังเก็บเอกสารต้นฉบับไว้ที่รากโครงการเพื่อไม่ให้สคริปต์เดิมพัง
- ห้ามลบหรือย้ายต้นฉบับจนกว่า Phase 2 จะตรวจจุดอ้างอิงและ Regression ผ่านทั้งหมด
- ให้รัน `npm run docs:history-check` ก่อนส่งแพตถัดไป

## สถานะการย้าย

- Phase 1: คัดลอกและตรวจความตรงกัน — เสร็จใน v0.14.60
- Phase 2: เปลี่ยนจุดอ้างอิง ทดสอบ แล้วเก็บต้นฉบับออก — ยังไม่ดำเนินการ
