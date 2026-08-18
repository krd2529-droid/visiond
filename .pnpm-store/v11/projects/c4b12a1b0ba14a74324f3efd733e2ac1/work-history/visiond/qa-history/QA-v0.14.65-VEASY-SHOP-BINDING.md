# QA v0.14.65 — V Easy Shop Binding

- ตรวจ Unique Constraint ของ License และ Meta Page ID
- ตรวจ Session user ตรงกับ license.user_id และ shop.user_id
- ตรวจเฉพาะโปรแกรมประเภท `veasy`
- ตรวจคีย์หมดอายุ ระงับ หรือคนละบัญชีผูกร้านไม่ได้
- ตรวจผูกซ้ำร้านเดิมเป็น idempotent
- ตรวจคีย์เดิมสร้างร้านที่สองและ Page เดิมสร้างร้านใหม่ไม่ได้
- ตรวจ D1 batch สร้างร้านและเปลี่ยน binding state
- ตรวจ Ledger ปิดเฉพาะ Shop Binding; Runtime/Idempotency/Isolation ยังอยู่ในคิว

## ผลตรวจจริงก่อนแพ็ก

- Patch Test v0.14.65: ผ่าน `13/13`
- Regression: ผ่าน `30/30`
- Patch Coverage: `6/6`, missing `0`, uncertain `0`
- Source-to-Ledger: `27/27`, missing `0`
- Requirement Layer 2: ทั้งหมด `27`, verified `24`, pending ที่ลงทะเบียนแล้ว `3`, missing `0`, uncertain `0`
- JavaScript Syntax: ผ่านทั้งหมด
- Predeploy: PASS `8`, WARN `8`, FAIL `0`

คำเตือน Predeploy เป็นค่า Environment ตัวอย่างและ asset cache version เดิม ไม่ใช่บั๊กที่บล็อกแพตนี้
