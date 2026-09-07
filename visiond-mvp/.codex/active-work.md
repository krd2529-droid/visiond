# Active patch: ฐ1 Storefront Catalog and Production Migration Gate

- Event: PATCH_READY
- Outcome: ลด D1 ของหน้าร้านและรูปสินค้า พร้อมป้องกันกรณี deploy โค้ดแต่ลืม apply migration
- Acceptance: Production migration มีคำสั่งเฉพาะและตรวจสถานะได้; public catalog ใช้ server filter/keyset ไม่เกิน 24; cart ขอเฉพาะ slug ที่อยู่ในตะกร้า; catalog ไม่โหลดออเดอร์ย้อนหลัง 2,000 รายการ; รูปใช้ indexed lookup; cache key แยก query/cursor; pagination ไม่ซ้ำ/ไม่ตกหล่น
- Preserved: โปรโมชั่น, การจัดหมวด, สถานะซื้อแล้ว, รถเข็นสูงสุด 30 ชิ้น, หน้ารายละเอียดสินค้า และสิทธิ์ผู้ใช้เดิม
- Root causes: migration 0086 ไม่ถูก apply ใน Production; `/api/products` คืนทั้งคลังและ aggregate ทั้งระบบ; catalog/cart โหลด orders/catalog ทั้งชุด
- Phase: local verification complete
- Files changed: functions/api/products/index.js, functions/api/orders/product-status.js, functions/api/media/[key].js, functions/_schema.js, migrations/0087_storefront_catalog_indexes.sql, public/catalog-sync.js, public/cart.js, version/cache-bust files, package scripts, regression tests
- Production blocker: D1 daily row-read quota exceeded; migration apply/EXPLAIN ต้องทำหลัง reset
- Verification: v0.20.54 ฐ1 catalog PASS; v0.20.53 admin D1 regression PASS; visible version parity PASS
- Next action: run predeploy gate, commit/push, verify production response; apply remote migration after D1 quota reset if runtime compatibility gate cannot complete it first
