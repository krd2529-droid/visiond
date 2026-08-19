# Patch v0.14.306 — เพิ่ม EP โดยตรง

## แก้อะไร

- ปุ่ม `เพิ่ม EP` เพิ่ม EP ใหม่ทันทีโดยไม่บังคับชื่อ คลิป หรือเอกสารก่อน
- เอา validation หน้าเว็บและ API ที่ขวางการเพิ่ม EP ออก
- การโหลดหน้าใหม่ไม่ลบ EP ที่ผู้ใช้เพิ่ม
- ตอนส่งตรวจยังนับเฉพาะ EP ที่มีชื่อพร้อมคลิปหรือเอกสาร
- โหลด `course-seller.js` ด้วย cache key ของแพต v0.14.306

## ทดสอบ

- focused regression `test-v014306.mjs`
- regression contracts ทั้งหมด
- predeploy check และ security scan

## ขอบเขต

- ไม่เปลี่ยนกฎแก้ไขหรือลบ EP
- ไม่ Push และไม่ Deploy
