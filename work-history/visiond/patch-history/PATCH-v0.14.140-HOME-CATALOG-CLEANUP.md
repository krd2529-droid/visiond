# PATCH v0.14.140 — Home Catalog Cleanup and Course Search

วันที่: 2026-08-11

## ผลลัพธ์

- รวม V-Learning intro กับรายการคอร์สไว้ใน section เดียว
- เพิ่มช่องค้นหาคอร์สและสถานะจำนวนผลลัพธ์
- ลด action บนการ์ดคอร์สเหลือปุ่มเดียวตามสถานะสิทธิ์
- นำคอร์สออนไลน์ออกจากตัวกรองสินค้าดิจิทัล
- ถอด section ประเภทสินค้าดิจิทัลและ CSS ที่ไม่ใช้งาน
- bump เวอร์ชันหน้าเว็บ หลังบ้าน และ asset cache เป็น v0.14.140

## QA

- `npm run test:v014140`
- `npm run predeploy:check`
