# Active patch: Product-link copy column across tables

- Event: PATCH_DELIVERED
- Outcome: เพิ่มคอลัมน์ลิงก์สินค้าแบบปุ่มคัดลอกสั้นในทุกตารางสินค้า
- Preserve: ลิงก์จาก TikTok เท่านั้น ไม่มีการสร้าง URL ปลอม; คอลัมน์และ action เดิมทั้งหมด
- Acceptance: sold products, Showcase, Marketplace ทั้งสองโหมด, ผลวิเคราะห์, กลุ่มสินค้า และลิสต์ถาวรมีคอลัมน์ลิงก์; คัดลอกได้; ไม่มี URL แสดงไม่มีลิงก์; empty colspan ถูกต้อง
- Phase: deployed to production and verified (JS 02099, CSS 02082)
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, scripts/test-tiktok-product-link-columns.mjs และ regression tests ที่ตรึง asset version
