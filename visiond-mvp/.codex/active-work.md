# Active patch: Marketplace to selection list

- Event: PATCH_STARTED
- Outcome: เพิ่มคอลัมน์ลิสต์คัดสินค้าถัดจาก Showcase และปุ่มเก็บสินค้า Marketplace เข้าลิสต์คัดสินค้า
- Preserve: ปุ่มเพิ่ม Showcase เดิม; การค้นหา/แบ่งหน้า; กติกาลิสต์คัดสินค้าและป้องกันรายการซ้ำ
- Acceptance: ตารางร้านค้าและ Open Collaboration มีคอลัมน์ใหม่; ปุ่มบันทึกสินค้าเป็น C พร้อมลิงก์และที่มา; เริ่มรอบตรวจ 3 วัน; แจ้งเมื่อซ้ำ; โหลดลิสต์ล่าสุดหลังบันทึก
- Event: PATCH_DELIVERED
- Phase: committed and pushed to origin/main; production serves JS 02095 / CSS 02078
- Verification: selection-list contract test, Marketplace search/adversarial regressions, syntax checks, predeploy check, git diff check, production asset inspection
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, functions/api/admin/tiktok-analyzer/index.js, scripts/test-tiktok-marketplace-selection-list.mjs
