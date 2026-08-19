# PATCH v0.14.308 — COURSE-EP-CONTINUOUS-002

## แก้อะไร

- ตัดการ render Dashboard และการเปิด draft เก่าออกจากหน้าสร้าง `?type=1`
- ทำให้ฟอร์มตะกร้าและ EP แสดงคงที่เมื่อเปิดหรือรีเฟรชหน้า
- ป้องกัน setup ซ้ำแล้วปุ่มส่งตรวจถูกปิด

## ห้ามกระทบ

- Dashboard ศูนย์จัดการคอร์ส
- การแก้ไขคอร์สเดิมจาก `course_id`
- ขั้นตอนอนุมัติของ Boss

## ทดสอบ

- `node scripts/test-v014308.mjs`
- `node scripts/test-all-regressions.mjs`
- `node scripts/predeploy-check.mjs`
