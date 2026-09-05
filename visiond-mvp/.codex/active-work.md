# Active patch: Remove shortlist target note

- Event: PATCH_DELIVERED
- Outcome: ลบข้อความเป้าหมาย 30 สินค้าหลักออกจากลิสต์คัดสินค้า
- Preserve: เข้าแผงจัดการสินค้าตรง; ไม่มีแถบ 1/2; + ช่องใหม่เปิด TikTok OAuth
- Acceptance: ไม่แสดงบรรทัดเป้าหมาย A/B/C/E; ปุ่มเพิ่ม C และรายการลิสต์ยังอยู่
- Phase: deployed as f7fc87b9; production asset 02108 verified with target note absent
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, tests
