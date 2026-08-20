# PATCH v0.14.398 — Partner Health Schema Hot-Path Guard

## Scope

- ใช้ runtime schema state v66 เป็นหลักฐานว่าตาราง/index ของ Partner Health พร้อมแล้ว
- ข้าม `PRAGMA table_info`, `ALTER TABLE` และ `CREATE INDEX` บน webhook/health request ปกติ
- คง legacy bootstrap fallback สำหรับฐานข้อมูลที่ยังไม่มี `runtime_schema_state`

## ไม่เปลี่ยน

- Partner credential, scope และ audit
- Webhook signature, queue, retry, dead letter และ health alerts
- API contract, UI และ theme

## Verification

- Focused test ยืนยันว่า schema พร้อมแล้วใช้ probe เดียวต่อ isolate และไม่มี DDL
- Partner API security gate
- Visible version, regression และ predeploy ผ่าน patch gate

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
