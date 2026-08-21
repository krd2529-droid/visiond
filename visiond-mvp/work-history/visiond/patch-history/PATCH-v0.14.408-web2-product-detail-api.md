# PATCH v0.14.408 — Web 2 Product Detail API

## Runtime

- เพิ่ม `GET /api/partner/v1/products/{id}`
- ใช้ credential และ Scope `products:read` เดิม
- คืนเฉพาะ metadata ของ published, non-deleted product/vision7-key ที่ไม่ใช่ resale-rights
- point query ด้วย product ID และ `LIMIT 1`
- invalid ID ตอบ 400; สินค้าที่ไม่พร้อมเผยแพร่ตอบ 404
- ไม่คืน `product_files`, object key, download URL, token หรือ entitlement

## Integration

- Starter Client เพิ่ม `product(id)`
- คู่มือและ HTTP placeholder เพิ่มตัวอย่าง Product Detail
- Security gate ครอบคลุม endpoint ใหม่

## Verification

- `scripts/test-v014408.mjs`
- Partner API security gate
- current regression, visible-version และ predeploy

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
