# PATCH v0.14.392 — Analytics Event Scope

## เป้าหมาย

ลด low-value telemetry โดยไม่ตัด Business, Auth, Payment หรือ Security events

## การเปลี่ยนแปลง

- `ui_click` ส่งเฉพาะ element ที่มี `data-analytics-click`
- Business Event ไม่ส่ง `ui_click` ซ้ำ
- Admin, Login และ Register ไม่โหลด Storefront Analytics
- Login/Register success ยังคงบันทึกจาก Auth API
- อัปเดต cache key ของ Analytics ในหน้าร้านที่ยังใช้งาน

## หลักฐานทดสอบ

- Focused: `scripts/test-v014392.mjs`
- Gate: `scripts/patch-gate.mjs`

## Deployment

- Commit เท่านั้น; ยังไม่ Push หรือ Deploy
