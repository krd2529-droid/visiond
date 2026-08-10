# QA v0.14.63 — Vision 7 Key Center

- ตรวจสิทธิ์ Admin/Boss ทุก API
- ตรวจว่า Secret ไม่พร้อมแล้วออกคีย์ไม่ได้
- ตรวจคีย์ V Easy เริ่มที่ `unbound`
- ตรวจแพ็กเกจรายเดือนใช้ 30 วันและรายปีใช้ 365 วัน
- ตรวจเมนูหลังบ้านและหน้าจอมือถือ
- ตรวจ Source-to-Ledger ครบทั้ง Event Case เดิมและ V Easy ชุดใหม่
- รัน Patch Test, Regression, Coverage, Layer 2 และ Predeploy ก่อนสร้าง ZIP

## ผลตรวจจริงก่อนแพ็ก

- Patch Test v0.14.63: ผ่าน `11/11`
- Regression: ผ่าน `28/28`
- Patch Coverage: `6/6`, missing `0`, uncertain `0`
- Source-to-Ledger: `27/27`, missing `0`
- Requirement Layer 2: ทั้งหมด `27`, verified `21`, pending ที่ลงทะเบียนแล้ว `6`, missing `0`, uncertain `0`
- JavaScript Syntax: ผ่านทั้งหมด
- Predeploy: PASS `8`, WARN `8`, FAIL `0`

คำเตือน Predeploy เป็นค่า Environment ตัวอย่างและ asset cache version เดิม ไม่ใช่บั๊กที่บล็อกแพตนี้
