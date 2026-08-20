# PATCH v0.14.399 — Partner Sync Schema Hot-Path Guard

## Scope

- Customer Sync, Order Sync และหน้า Admin Partner Data ใช้ runtime schema state v66
- ข้าม Sync `CREATE TABLE/INDEX` เมื่อ migration พร้อมแล้ว
- คง legacy bootstrap fallback สำหรับฐานข้อมูลที่ยังไม่มี runtime schema state

## ไม่เปลี่ยน

- Partner credential, scope และ audit
- Customer encryption, validation และ idempotency
- Order totals, refund/status transition และ idempotency
- API contract, UI และ theme

## Verification

- Focused test ยืนยัน probe เดียวต่อ isolate และไม่มี Sync DDL เมื่อ schema พร้อม
- Partner API security gate
- Visible version, regression และ predeploy ผ่าน patch gate

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
