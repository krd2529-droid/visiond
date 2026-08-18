# PATCH v0.14.213 — Bundle File Type Persistence

- บันทึกประเภทไฟล์ชุดรวมตามค่า PDF, ZIP, JPG/PNG หรือชุดรวมหลายประเภทที่เลือก
- ไม่เขียนทับค่าด้วย `ชุด PDF` ซึ่งไม่มีใน Dropdown
- โหลดค่าจากฐานข้อมูลกลับเข้า Editor ได้ตรงเดิมทั้ง Draft และ Published
- Rollback ด้วย `git revert` Commit ของแพตนี้ โดย Boss เป็นผู้ Push/Deploy เท่านั้น
