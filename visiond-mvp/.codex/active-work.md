# Active patch: Shop-search selection list

- Event: PATCH_READY
- Outcome: เอาคอลัมน์ราคาออกจากผลค้นหาร้านค้า และเพิ่มลิสต์คัดสินค้าพร้อมปุ่มเพิ่มแบบเดียวกับ Showcase
- Preserve: การเลือกหลายรายการ ปุ่มเพิ่ม Showcase ยอดขาย ค่าคอม หมวดหมู่ pagination และการเชื่อมบัญชี
- Acceptance: ตารางค้นหาร้านค้าไม่มีราคา; มีหัวคอลัมน์ลิสต์คัดสินค้า; ทุกรายการเพิ่มเป็น C พร้อมลิงก์และหลักฐานได้; empty state span ถูกต้อง
- Phase: focused workflow tests and pre-deploy checks passed; ready to deliver
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.html, scripts/test-tiktok-marketplace-selection-list.mjs, scripts/test-tiktok-marketplace-supported-columns.mjs
