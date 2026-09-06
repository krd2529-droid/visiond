# Active patch: Open Collaboration table edge spacing

- Event: PATCH_DELIVERED
- Outcome: ปุ่มคอลัมน์ลิสต์คัดสินค้ามีระยะหายใจจากขอบขวาและไม่ดูตกกรอบ
- Preserve: คอลัมน์และปุ่มเดิม, horizontal scrolling, responsive behavior, Marketplace actions
- Acceptance: last column has explicit width/right padding; button fits within cell; related Marketplace tests pass
- Phase: CSS spacing and 10 related Marketplace regressions PASS; production verified
- Files: public/tiktok-analyzer.css, public/tiktok-analyzer.html, scripts/test-tiktok-marketplace-pagination-layout.mjs
- Delivered: 0c6e1174 on origin/main; /tiktok-analyzer uses CSS v02086
