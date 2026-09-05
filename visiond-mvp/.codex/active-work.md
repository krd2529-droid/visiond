# Active patch: Marketplace pagination placement

- Event: PATCH_STARTED
- Outcome: ย้ายปุ่มดูหน้าถัดไปไปมุมขวาใต้ตารางและแยกจากปุ่มเพิ่ม Showcase
- Preserve: พฤติกรรมแบ่งหน้า ข้อความกำกับ และปุ่มดำเนินการทั้งหมด
- Acceptance: pagination อยู่ใต้กรอบตาราง ชิดขวา มีระยะห่างชัดทั้ง desktop/mobile
- Event: PATCH_DELIVERED
- Phase: committed and pushed to origin/main; production serves CSS 02079
- Verification: pagination layout contract, selection-list and Marketplace adversarial regressions, predeploy check, git diff check, production asset inspection
- Files: public/tiktok-analyzer.css, public/tiktok-analyzer.html, scripts/test-tiktok-marketplace-pagination-layout.mjs
