# VisionD v0.14.193 — V12 V Connect Broadcast Center

## แก้อะไร
- เพิ่มการส่งข้อความและรูปแบบบรอดแคสต์ LINE/Facebook จากหลังบ้าน
- เพิ่มคิว ประวัติผล และ Retry เฉพาะรายการล้มเหลว
- เพิ่ม Facebook Page credential แบบเข้ารหัสและตัวส่งข้อความตรงใน Inbox

## แก้ไฟล์ใด
- `functions/api/admin/v12-broadcast.js`, `v12-channel.js`, `v12-connect.js`
- `public/v12-connect.html`, `v12-connect.js`, `v12-connect.css`
- `migrations/0042_v12_broadcast_center.sql` และไฟล์เวอร์ชัน/โรดแมพ/ทดสอบ

## การทดสอบ
- Focused PASS, syntax PASS, regression 15/15, patch coverage 4/4
- Predeploy PASS 8 / WARN 9 / FAIL 0 และ secret scan ไฟล์ที่แก้ PASS

## Commit
- บันทึก Commit ID หลังผ่านการทดสอบ

## ย้อนกลับ
- ใช้ `git revert <Commit v0.14.193>`; Commit ก่อนหน้า `ca5beb7951972b1cf50523f2d436bbd4a8afeac7`; Safe baseline `5ea8741`
