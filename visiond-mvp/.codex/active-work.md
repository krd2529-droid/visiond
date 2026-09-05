# Active patch: Login-only TikTok channel connection

- Event: PATCH_DELIVERED
- Outcome: หน้าเชื่อมช่องมีเพียงการล็อกอิน TikTok และสร้างช่องจากโปรไฟล์อัตโนมัติ
- Preserve: ช่องเดิม หน้า 2 จัดการสินค้า การเชื่อม TikTok Shop และข้อมูลที่ซิงก์ไว้
- Acceptance: + ช่องใหม่เปิด TikTok OAuth โดยไม่สร้างช่องเปล่า; callback สร้าง/เลือกช่องจากบัญชี; ไม่มีแบบฟอร์มชื่อ ลิงก์ ช่วงวัน แนบรูป หรือวิเคราะห์ในหน้าเชื่อมช่อง
- Phase: deployed and visually verified on production (JS 02101, CSS 02083)
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, functions/api/tiktok/connect.js, functions/api/tiktok/callback.js, tests
