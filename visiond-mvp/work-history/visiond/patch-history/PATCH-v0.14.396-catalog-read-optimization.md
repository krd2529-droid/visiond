# PATCH v0.14.396 — Catalog Read Optimization

## เป้าหมาย

ลด D1 hot-read ของแคตตาล็อกโดยรักษารายการสินค้าและ response contract เดิม

## การเปลี่ยนแปลง

- Cache `/api/products` 60 วินาที; cache hit ไม่แตะ D1
- รวม analytics, legacy views และ bundle pages เป็น aggregate CTE อย่างละรอบ
- ตัด Trash purge ออกจาก Public Catalog GET
- Daily analytics maintenance รับช่วง Trash purge และรายงานจำนวนที่จัดการ

## Pagination Decision

- ยังไม่บังคับ pagination กับ Storefront เพราะหน้าแรก แคตตาล็อก ตะกร้า และสิทธิ์คอร์สต้องใช้สินค้าครบ
- Partner API/Web 2 ต้องใช้ cursor pagination ใน endpoint Partner แยก ไม่เปลี่ยน Storefront contract รอบนี้

## หลักฐานทดสอบ

- Focused: `scripts/test-v014396.mjs`
- Gate: `scripts/patch-gate.mjs`

## Deployment

- Commit เท่านั้น; ยังไม่ Push หรือ Deploy
