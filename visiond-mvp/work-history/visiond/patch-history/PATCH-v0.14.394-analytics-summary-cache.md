# PATCH v0.14.394 — Analytics Summary และ Cache

## เป้าหมาย

ลด D1 Rows read จากการนับ unique visitor และการอ่านสถิติสาธารณะซ้ำ

## การเปลี่ยนแปลง

- เพิ่ม `analytics_summary` และ trigger เพิ่ม unique เฉพาะ visitor ใหม่
- migration 0066 คำนวณค่าเริ่มต้นครั้งเดียวและยก runtime schema เป็น 66
- `analyticsStats()` ใช้ point lookup แทน UNION visitor tables
- GET Analytics ใช้ Cache API 5 นาทีและ cache hit ก่อน D1 readiness/rate limit
- Browser และ Promo ยอมใช้ public cache โดยไม่บังคับ no-store

## หลักฐานทดสอบ

- Focused: `scripts/test-v014394.mjs`
- Gate: `scripts/patch-gate.mjs`

## Deployment

- Commit เท่านั้น; ยังไม่ Push หรือ Deploy
- Deploy ต้องใช้ migration 0066 ก่อน Production Validation
