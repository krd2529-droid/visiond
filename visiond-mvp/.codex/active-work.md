# Active patch: Shortlist visible-count reconciliation

- Event: PATCH_READY
- Outcome: ให้ยอดรวมลิสต์คัดสินค้าตรงกับจำนวนการ์ดที่แสดงหลังตัดรายการ discarded
- Preserve: การซ่อนสินค้าที่คัดออก ลำดับการ์ด และยอดแยกเกรด A–F
- Acceptance: หลัง reconcile ยอดรวมใช้จำนวน `.product-prep-item` ที่เหลือ; กรณี 7 รายการถูกคัดออก 4 ต้องแสดง 3/40 และมีการ์ด 3
- Phase: visible-count, discarded-product, refresh, and pre-deploy checks passed
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.html, scripts/test-tiktok-shortlist-visible-count.mjs, scripts/test-tiktok-discarded-product-visibility.mjs, scripts/test-tiktok-marketplace-selection-list.mjs, scripts/test-tiktok-refresh-hydration.mjs
