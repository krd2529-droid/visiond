# Active patch: Manual C button visual consistency

- Event: PATCH_READY
- Outcome: ทำปุ่มเพิ่มสินค้า C ด้วยตนเองให้ใช้ visual system เดียวกับปุ่มหลักใน TikTok Analyzer
- Preserve: submit behavior การสร้างเกรด C และรอบตรวจ 3 วัน
- Acceptance: ปุ่มสูง 42px มุม 10px สีเขียว ตัวหนา มี hover/focus/disabled ที่ชัดเจน และ mobile เต็มแถวเดิม
- Phase: visual contract, related regression, and pre-deploy checks passed
- Files: public/tiktok-analyzer.css, public/tiktok-analyzer.html, scripts/test-tiktok-manual-c-button-style.mjs, scripts/test-tiktok-table-header-system.mjs, scripts/test-tiktok-marketplace-selection-list.mjs, scripts/test-tiktok-marketplace-pagination-layout.mjs
