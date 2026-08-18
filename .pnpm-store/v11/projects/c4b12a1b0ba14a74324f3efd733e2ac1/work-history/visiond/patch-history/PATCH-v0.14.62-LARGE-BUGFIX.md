# PATCH v0.14.62 — Large Bugfix

## งานที่แก้

- เปลี่ยนการย้ายเอกสารรุ่นเก่าที่เนื้อหาต่างจาก archive ให้เก็บใน `legacy-versions/` แทนการลบ
- บังคับจำนวนเครื่อง Vision 7 ในคำสั่งฐานข้อมูลเดียว รวมกรณีเครื่องที่เคยถูกปิด
- ให้ Meta Webhook reclaim งาน `processing` ที่ค้างเกิน 5 นาที
- นำ Account renderer รุ่นเก่าที่ไม่ถูกใช้งานและประกอบ HTML จากข้อมูลดิบออก (หน้า Account ปัจจุบัน redirect ไป Login อยู่แล้ว)
- เติม Patch Ledger v0.14.60 และบังคับตรวจ Ledger ต่อเนื่องถึงแพตปัจจุบัน
- เพิ่ม Requirement snapshot v0.14.62 และเทสต์จำลอง archive เสียจริง
- นำไฟล์ขยะ `public/admin.html.tmp` ออก

## กติกาหลังแพต

รัน `npm run test:v01462`, Regression, Coverage, Layer 2 และ Predeploy ก่อนส่ง ZIP ทุกครั้ง

## ผลตรวจส่งมอบ

- v0.14.62 test: 8/8
- Regression: 27/27
- Patch Coverage: 6/6
- Requirement Coverage: 20/20
- งานหลุด/ไม่แน่ใจ: 0
- Predeploy: FAIL 0

**EVENT CASE: เสร็จทั้งหมดแล้ว — พร้อมรับ Event Case ใหม่**
