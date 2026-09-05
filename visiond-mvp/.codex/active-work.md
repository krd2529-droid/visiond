# Active patch: Direct product-management entry

- Event: PATCH_DELIVERED
- Outcome: ลบแถบสลับหน้าและเข้าแผงจัดการสินค้าของช่องโดยตรง
- Preserve: + ช่องใหม่เปิด TikTok OAuth; ช่องเดิม ข้อมูลสินค้า และทางเชื่อม TikTok Shop เมื่อสิทธิ์ขาด
- Acceptance: ไม่มีแถบ 1/2 และไม่มีการ์ดล็อกอินกลางหน้า; โหลดหน้าแล้วเป็น output channel; เลือกการ์ดช่องแล้วยังอยู่หน้าจัดการสินค้า; + ช่องใหม่เป็นจุดเพิ่มช่องเพียงจุดเดียว
- Phase: deployed and verified on production (commit 333e5b81)
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, tests
