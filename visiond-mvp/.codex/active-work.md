# Active patch: Remove product links from Showcase only

- Event: PATCH_READY
- Outcome: ลบลิงก์และคอลัมน์ลิงก์สินค้าเฉพาะตาราง Showcase
- Preserve: เข้าแผงจัดการสินค้าตรง; ไม่มีแถบ 1/2; + ช่องใหม่เปิด TikTok OAuth
- Acceptance: Showcase ไม่มีลิงก์สินค้า; ตารางสินค้าอื่นยังมีปุ่มคัดลอกลิงก์; จำนวนคอลัมน์และ empty state ถูกต้อง
- Phase: tests passed; ready to deploy
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, tests
