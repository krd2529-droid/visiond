# Active patch: Sold-products selection-list action

- Event: PATCH_READY
- Outcome: เพิ่มคอลัมน์ลิสต์คัดสินค้าและปุ่มเพิ่มเข้าลิสต์ในตารางสินค้าที่ขายได้
- Preserve: ยอดออเดอร์ เกรด วันที่ และปุ่มคัดลอกลิงก์เดิม; ไม่เพิ่มสินค้าซ้ำ
- Acceptance: ตารางมีหัวคอลัมน์และปุ่ม; ปุ่มบันทึกสินค้าเป็น C พร้อม URL/evidence; รายการที่มีอยู่แล้วถูกปิดปุ่ม; สถานะตารางไม่เหลื่อม
- Phase: implementation and regression tests passed; ready to commit and deploy
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.html, functions/api/admin/tiktok-analyzer/index.js, tests
