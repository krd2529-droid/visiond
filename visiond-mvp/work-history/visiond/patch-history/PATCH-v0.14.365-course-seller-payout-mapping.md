# PATCH v0.14.365 — Course Seller Payout Mapping

- ลงทะเบียน `COURSE-PAYOUT-001` ครบ payment profile validation, QR object lifecycle และ entitlement-based authorization
- ระบุ `PARTIAL` ตามจริง เพราะ course-center ไม่มี payment profile panel/client แม้ dashboard และ publish flow อ้างถึง
- ไม่เพิ่ม marker หลอกและไม่เปลี่ยน payment, publish, order, API contract หรือ theme

`EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`

งานถัดไป: Coverage Audit ต้องตรวจ Seller Slip API settings/routes เทียบ Feature Map
