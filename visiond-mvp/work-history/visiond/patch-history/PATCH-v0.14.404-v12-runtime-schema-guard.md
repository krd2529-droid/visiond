# PATCH v0.14.404 — V12 Runtime Schema Guard

## Scope

- ใช้ `runtime_schema_state` v66 เป็น readiness marker ของ V12 schema
- Memoize readiness ต่อ D1 binding/isolate
- Settings, Profile และ Broadcast ข้าม runtime bootstrap, PRAGMA, CREATE และ ALTER เมื่อ migration พร้อม
- คง legacy fallback สำหรับฐานข้อมูลที่ยังไม่มี runtime schema state

## Query Budget

- Schema พร้อม: 1 point probe ต่อ isolate แล้ว 0 V12 schema DDL/PRAGMA ใน request ถัดไป
- เดิม: ทุก ensure เรียก runtime schema ต่อด้วย 2 PRAGMA, 5 CREATE/INDEX และ conditional ALTER

## ไม่เปลี่ยน

- Facebook credential, profile recovery และ broadcast contracts
- Webhook, AI reply, inbox และ bot control
- UI และ theme

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
