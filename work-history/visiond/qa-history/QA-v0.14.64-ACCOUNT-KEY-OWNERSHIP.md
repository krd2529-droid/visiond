# QA v0.14.64 — Account + Key Ownership

- ตรวจล็อกอินด้วย username/email และ password hash เดิมของ VisionD
- ตรวจ rate limit ทั้ง IP และชื่อบัญชี
- ตรวจว่า Token จริงไม่ถูกบันทึกลงฐานข้อมูล
- ตรวจ Token ผูกบัญชีและเครื่อง พร้อม revoke และ expiry
- ตรวจทุก query ของ Activation จำกัดด้วย `license.user_id = session.user_id`
- ตรวจ Ledger ว่าปิดเฉพาะ `VE-AUTH-001`; งานร้านและ Runtime ยังคง `PENDING`

## ผลตรวจจริงก่อนแพ็ก

- Patch Test v0.14.64: ผ่าน `12/12`
- Regression: ผ่าน `29/29`
- Patch Coverage: `6/6`, missing `0`, uncertain `0`
- Source-to-Ledger: `27/27`, missing `0`
- Requirement Layer 2: ทั้งหมด `27`, verified `22`, pending ที่ลงทะเบียนแล้ว `5`, missing `0`, uncertain `0`
- JavaScript Syntax: ผ่านทั้งหมด
- Predeploy: PASS `8`, WARN `8`, FAIL `0`

คำเตือน Predeploy เป็นค่า Environment ตัวอย่างและ asset cache version เดิม ไม่ใช่บั๊กที่บล็อกแพตนี้
