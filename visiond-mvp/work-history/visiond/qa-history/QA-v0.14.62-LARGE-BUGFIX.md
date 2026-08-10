# QA v0.14.62 — Large Bugfix

ตรวจยืนยันหัวข้อต่อไปนี้:

- archive เสียหรือเนื้อหาต่างแล้วต้นฉบับต้องถูกเก็บกู้คืนได้ ไม่ถูกลบทิ้ง
- เครื่องที่ revoke ต้องผ่านเพดานจำนวนเครื่องก่อน reactivation
- Webhook `processing` ค้างเกินเวลาได้รับการ reclaim
- ไม่มีหน้า HTML ใดโหลด Account renderer รุ่นเก่าที่เสี่ยง HTML injection และนำไฟล์ที่ไม่ใช้งานออกแล้ว
- Patch Ledger ต่อเนื่อง v0.14.54–v0.14.62
- Requirement snapshot ล่าสุดตรงกับ VERSION
- Regression, Syntax, Coverage และ Predeploy ผ่านก่อนส่งมอบ

## ผลรอบสุดท้าย

- Patch test 8/8
- Regression 27/27
- Patch Coverage 6/6
- Source-to-Ledger 20/20
- Requirement Coverage 20/20
- Layer 2 snapshots 4, missing 0, uncertain 0
- Syntax ผ่านทั้งหมด
- Predeploy PASS 8, WARN 8, FAIL 0
