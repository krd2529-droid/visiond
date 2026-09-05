# Active patch: Remove redundant product-management heading

- Event: PATCH_DELIVERED
- Outcome: ลบการ์ดหัวข้อ “จัดการสินค้า” ใต้ตัวเลือกช่อง
- Preserve: เข้าแผงจัดการสินค้าตรง; ไม่มีแถบ 1/2; + ช่องใหม่เปิด TikTok OAuth
- Acceptance: ไม่แสดงหัวข้อ/คำอธิบายซ้ำ และส่วนตารางสินค้ายังทำงานเหมือนเดิม
- Phase: deployed as c12bb64f; production asset 02105 verified with heading absent
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, tests
