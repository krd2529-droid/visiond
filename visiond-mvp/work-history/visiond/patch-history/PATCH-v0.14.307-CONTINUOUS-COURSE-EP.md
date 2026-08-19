# PATCH v0.14.307 — COURSE-EP-CONTINUOUS-001

## แก้อะไร

ปุ่มเพิ่ม EP สร้างกล่องใหม่ในหน้าเดิมทันที และปุ่มส่งตรวจจุดเดียวจัดการตะกร้าคอร์สพร้อม EP ทั้งหมด

## ขอบเขต

- หน้า: `/course-seller?type=1`
- UI: `public/course-seller.html`, `public/course-seller.js`
- API เดิมที่ใช้: `/api/course-seller`, `/api/course-seller/:id/lessons`, `/api/course-seller/:id/publish`

## ห้ามกระทบ

- การแก้ EP ของคอร์สเดิม
- การอนุมัติคอร์สโดย Boss
- เครดิตหรือข้อมูลบัญชีรับเงิน

## ทดสอบ

- เพิ่ม EP ไม่เรียก API ไม่ตรวจฟอร์ม และไม่เลื่อนหน้า
- EP ว่างไม่ถูกส่ง
- regression ทั้งหมดและ predeploy ผ่าน
