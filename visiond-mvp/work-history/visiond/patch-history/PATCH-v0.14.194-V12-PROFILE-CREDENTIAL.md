# VisionD v0.14.194 — V12 Profile และ Facebook Credential

## แก้อะไร
- แสดงชื่อลูกค้าและรูปโปรไฟล์จริงในรายการ/หัวแชท
- แก้ตาราง V12 ไม่พร้อมจนบันทึก Facebook ไม่ได้ และเพิ่มข้อความวิเคราะห์ Token/Page ID/สิทธิ์

## ไฟล์หลัก
- `_v12_schema.js`, `_veasy_line_ai.js`, `_veasy_runtime.js`
- `v12-channel.js`, `v12-connect.js/html`, `v12-profile.css`, migration 0043

## ทดสอบ
- Focused PASS, syntax PASS, regression 15/15, patch coverage 4/4
- Predeploy PASS 8 / WARN 9 / FAIL 0 และ secret scan ไฟล์ที่แก้ PASS

## ย้อนกลับ
- `git revert SELF`; parent `f491542cab9428ccc38e8cf53f01014e3250e104`; safe baseline `5ea8741`
