# PATCH v0.14.395 — Analytics Write Reduction

## เป้าหมาย

ลด D1 writes/reads ต่อ Public Analytics request โดยไม่ลดการป้องกัน Auth, Payment หรือ Download

## การเปลี่ยนแปลง

- Public Analytics ใช้ edge-memory rate limit แบบ bounded ต่อ isolate
- View/Event duplicate ใช้ Cache API หรือ memory fallback แทน D1 query
- View ใหม่ไม่เขียน raw `page_views`; เขียนเฉพาะ daily aggregate และ visitor upsert
- raw `page_views` เดิมยังอยู่ภายใต้ legacy retention
- Bot ไม่เข้า Event D1 path

## Trade-off

- Rate limit และ duplicate เป็น best-effort ต่อ edge/isolate อาจคลาดเคลื่อนข้าม colo แต่เหมาะกับ telemetry; strict account security limiter ยังใช้ D1 เดิม

## หลักฐานทดสอบ

- Focused: `scripts/test-v014395.mjs`
- Gate: `scripts/patch-gate.mjs`

## Deployment

- Commit เท่านั้น; ยังไม่ Push หรือ Deploy
