# PATCH v0.14.380 — Global Pointer Interaction Feature Map

- ลงทะเบียน `UI-POINTER-001` ครบ dynamic loaders, stylesheet dedupe, cursors/states, mouse navigation/press และ drag guard
- แยก runtime interaction ออกจาก `GOV-UI-DESIGN-001` ซึ่งเป็น design protocol
- เพิ่ม marker บน document root โดยไม่ทับ feature ของหน้า และไม่เปลี่ยน navigation, event, selectors, styles หรือ theme

`EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`

งานถัดไป: Coverage Audit หา runtime system ที่ยังไม่มีรหัสจากโค้ดจริง
