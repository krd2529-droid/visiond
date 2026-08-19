# PATCH v0.14.381 — Admin PDF Cover Maker Feature Map

- ลงทะเบียน `PRODUCT-PDF-COVER-001` ครบ dialog, input/template validation, canvas render, PNG download และ object URL cleanup
- ระบุ output จริงว่าเป็น PNG 1000×1400 และ controller ไม่ได้สร้าง PDF/ใช้ API/persist ข้อมูล
- เพิ่ม identifiers บน launcher/dialog โดยไม่เปลี่ยน component, rendering, validation, output หรือ UI/theme

`EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`

งานถัดไป: Coverage Audit หา runtime system ที่ยังไม่มีรหัสจากโค้ดจริง
