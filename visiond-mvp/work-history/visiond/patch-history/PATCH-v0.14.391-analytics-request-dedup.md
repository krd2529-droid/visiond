# PATCH v0.14.391 — Analytics Request Deduplication

## เป้าหมาย

ลด D1 amplification ในเส้นทางเปิดหน้า โดยไม่เปลี่ยน UI, Event taxonomy หรือระบบความปลอดภัยของบัญชี

## การเปลี่ยนแปลง

- POST page view บันทึกอย่างเดียวและไม่คำนวณ aggregate stats
- Bot ออกจากเส้นทางก่อน `ensureDatabase`, rate limit และ query
- Analytics กับ Promo ใช้ stats Promise ชุดเดียว
- ปุ่มที่ส่ง Business Event แล้วไม่ส่ง `ui_click` ซ้ำ

## หลักฐานทดสอบ

- Focused: `scripts/test-v014391.mjs`
- Gate: `scripts/patch-gate.mjs`

## Deployment

- Commit เท่านั้น; ยังไม่ Push หรือ Deploy
