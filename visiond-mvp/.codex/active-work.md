# Active patch: Remove redundant product-management heading

- Event: PATCH_READY
- Outcome: ลบการ์ดหัวข้อ “จัดการสินค้า” ใต้ตัวเลือกช่อง
- Preserve: เข้าแผงจัดการสินค้าตรง; ไม่มีแถบ 1/2; + ช่องใหม่เปิด TikTok OAuth
- Acceptance: ไม่แสดงหัวข้อ/คำอธิบายซ้ำ และส่วนตารางสินค้ายังทำงานเหมือนเดิม
- Phase: tests passed; ready to deploy
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, tests
