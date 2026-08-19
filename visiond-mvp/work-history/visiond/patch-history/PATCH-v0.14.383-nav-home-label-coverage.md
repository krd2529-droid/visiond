# PATCH v0.14.383 — NAV Shell Legacy Home Label Coverage

- เพิ่ม `home-my-button.js` ใต้ `NAV-SHELL-001` แทนการสร้างรหัสใหม่ให้ legacy helper
- ระบุ target, label, MutationObserver scope และ missing loader ตาม source coverage; canonical nav ยังคงเป็น active runtime
- ไม่เพิ่ม loader/marker และไม่เปลี่ยน label, navigation, observer หรือ UI/theme

`EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`

งานถัดไป: Coverage Audit หา runtime system ที่ยังไม่มีรหัสจากโค้ดจริง
