# PATCH v0.14.379 — Homepage Facebook Video Feature Map

- ลงทะเบียน `HOMEPAGE-VIDEO-001` ตาม controller, public setting API, URL allowlist, embed และ failure behavior ที่มีจริง
- ระบุ `PARTIAL`: ไม่พบสาม DOM anchors, loader/import หรือ settings writer จึงยังไม่มี active page route
- เพิ่ม identifier เมื่อ DOM contract มีอยู่ โดยไม่เปิดฟีเจอร์ เพิ่ม DOM/loader หรือเปลี่ยน API/UI/theme

`EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`

งานถัดไป: Coverage Audit หา runtime system ที่ยังไม่มีรหัสจากโค้ดจริง
