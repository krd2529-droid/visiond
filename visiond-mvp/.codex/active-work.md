# Active patch: Remove Marketplace category filter

- Event: PATCH_DELIVERED
- Outcome: ซ่อนตัวกรองหมวดหมู่สินค้าออกจากการค้นหาสินค้านางฟ้า
- Preserve: เข้าแผงจัดการสินค้าตรง; ไม่มีแถบ 1/2; + ช่องใหม่เปิด TikTok OAuth
- Acceptance: ไม่เห็น dropdown หมวดหมู่; ตัวกรองอื่นและการค้นหายังทำงาน; category_id ส่งเป็นค่าว่าง
- Phase: deployed as f1359f16; production asset 02107 verified with category filter hidden
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, tests
