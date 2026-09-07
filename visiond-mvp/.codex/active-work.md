# Active patch: Admin Product Catalog D1 Efficiency

- Event: PATCH_DELIVERED
- Outcome: ลดการอ่าน D1 ของหน้าจัดการสินค้า โดยไม่โหลดทั้งคลังซ้ำและยังคงการจัดการตะกร้าครบ
- Acceptance: รายการแบ่งหน้าฝั่ง SQL ไม่เกิน 24 รายการ; ค้นหา/สถานะทำที่ server; กลับแท็บเดิมภายใน TTL ไม่ยิงซ้ำ; คำขอซ้อนรวมเป็นหนึ่ง; รายละเอียดโหลดเมื่อเปิด; รูปอ้างอิงใช้ index แทน scan JSON; production Query Insights ลดลงอย่างมีนัยสำคัญ
- Root cause: `/api/admin/products` คืนทั้งคลังพร้อม correlated subqueries และ client refetch ทุกครั้ง; `/api/media/[key]` scan catalog ต่อรูป
- Phase: complete
- Files changed: public/admin.js, public/admin.html, public/product-sample-archive.js, functions/api/admin/products/index.js, functions/api/admin/categories/index.js, functions/api/media/[key].js, functions/_schema.js, migrations/0086_admin_product_catalog_indexes.sql, scripts/test-admin-product-d1-efficiency.mjs, VERSION.txt, public/index.html
- Verification: efficiency regression PASS; regression contracts 10/10 PASS; visible version parity PASS; predeploy PASS 9 / WARN 8 / FAIL 0
- Delivery: commits b24f6a3a and 95dcd636 pushed to origin/main; production WEB/ADMIN v0.20.53 returned HTTP 200
- Delivery note: admin catalog endpoints install the required indexes once per D1 binding, so the fix does not depend on remote migration CLI access
- Next action: monitor Cloudflare D1 Query Insights after the daily quota resets
