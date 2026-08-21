# PATCH v0.14.409 — Web 2 Commerce Order Create/Status

## Runtime

- migration 0067 สร้าง commerce order/items แยกจาก partner sales sync
- `POST /api/partner/v1/commerce/orders` ใช้ `commerce:write`
- `GET /api/partner/v1/commerce/orders/{external_order_id}` ใช้ `commerce:read`
- External ID และ Idempotency Key บังคับ; ลูกค้าต้อง sync และ active
- รับไม่เกิน 100 distinct products; ราคาและชื่ออ่านจาก published VisionD products
- สถานะเริ่มต้น `pending_payment`; ไม่รับยอดราคา/paid/fulfilled จาก Web 2
- status read scope ด้วย Website ID และอ่าน items สูงสุด 100

## Safety

- ไม่เขียน `orders`, `partner_orders` หรือ `entitlements` เดิม
- ไม่เปลี่ยน payment approval/download
- API 1 บาทไม่เป็น fee และไม่หักลูกค้า
- runtime schema guard ข้าม DDL เมื่อ migration version 67 พร้อม

## Verification

- `scripts/test-v014409.mjs`
- Partner API security gate
- current regression, visible-version และ predeploy

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
