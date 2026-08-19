# PATCH v0.14.366 — Seller Slip Auto-Verify Mapping

- ลงทะเบียน `SLIP-AUTO-VERIFY-001` ครบ token encryption, mode selection, slip guards และ manual fallback
- ระบุ `PARTIAL`: rights client ไม่ส่ง `enabled:true` และ course-center ไม่มี `slipApiPanel`
- ไม่แก้ token, verification, order grant, API contract หรือ theme

`EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`

งานถัดไป: Coverage Audit ตรวจ Course Seller order review routes (`approve`, `reject`, `slip`)
