# Active patch: Restore channel list after direct entry

- Event: PATCH_READY
- Outcome: รายการช่องเดิมต้องแสดงหลังโหลดหน้าโดยไม่ค้างที่ “กำลังโหลด…”
- Preserve: เข้าแผงจัดการสินค้าตรง; ไม่มีแถบ 1/2; + ช่องใหม่เปิด TikTok OAuth
- Acceptance: loadChannels วาดรายการได้หลัง analysisForm ถูกลบ; error แสดงในพื้นที่ที่ยังอยู่บนหน้า; production แสดงช่องเดิม
- Phase: regression suite passed; ready to deploy
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, tests
