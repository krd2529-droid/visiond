# Active patch: Unified TikTok table headers

- Event: PATCH_DELIVERED
- Outcome: ทำแถบหัวตารางทุกตารางใน TikTok Analyzer ให้เป็นระบบภาพเดียวกัน
- Preserve: เนื้อหา คอลัมน์ sticky header การเลื่อนแนวนอน และสีเกรดสินค้า
- Acceptance: product, sold-products, Showcase และ Marketplace ใช้สี ความสูง ระยะขอบ น้ำหนักตัวอักษร และกรอบเดียวกัน; mobile ไม่ล้นเพิ่ม
- Phase: committed, pushed to origin/main, and verified CSS v02080 on production
- Files: public/tiktok-analyzer.css, public/tiktok-analyzer.html, scripts/test-tiktok-table-header-system.mjs, scripts/test-tiktok-marketplace-selection-list.mjs, scripts/test-tiktok-marketplace-pagination-layout.mjs
