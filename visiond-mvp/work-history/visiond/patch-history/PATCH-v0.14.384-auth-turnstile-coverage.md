# PATCH v0.14.384 — Auth Turnstile Coverage

- เพิ่ม `security.js`, public config และ server verification ใต้ `AUTH-ACCOUNT-001`
- ระบุ widget/token callbacks, Siteverify/hostname checks และ site-key/secret-key mismatch boundary ตามโค้ดจริง
- เพิ่ม identifier บน dynamic slot โดยไม่เปลี่ยน config, SDK, auth, verification, failure behavior หรือ UI/theme

`EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`

งานถัดไป: Coverage Audit หา runtime system ที่ยังไม่มีรหัสจากโค้ดจริง
