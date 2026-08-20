# PATCH v0.14.397 — Partner Products Scale Safety

## เป้าหมาย

รองรับ Web 2 ที่ต้องไล่สินค้าเกิน 100 รายการโดยไม่เพิ่มก้อน response และไม่รัน Partner schema DDL ซ้ำ

## การเปลี่ยนแปลง

- runtime schema version 66 ข้าม Partner `CREATE TABLE/INDEX`; ฐานเก่ายังคง fallback
- limit ค่าเริ่มต้น 50 สูงสุด 100 และ cursor canonical เป็น integer
- response เพิ่ม `pagination.has_more` โดยคง `next_cursor`
- Starter Kit เพิ่ม async generator `productPages()` พร้อม loop/repeated-cursor guard
- คู่มือและ Feature Map ระบุวิธีไล่สินค้าหลายหน้า

## Security Boundary

- คง Partner credential, least-privilege scope, per-request audit และ `last_used_at` เดิม

## หลักฐานทดสอบ

- Focused: `scripts/test-v014397.mjs`
- Partner security gate และ Patch Gate

## Deployment

- Commit เท่านั้น; ยังไม่ Push หรือ Deploy
