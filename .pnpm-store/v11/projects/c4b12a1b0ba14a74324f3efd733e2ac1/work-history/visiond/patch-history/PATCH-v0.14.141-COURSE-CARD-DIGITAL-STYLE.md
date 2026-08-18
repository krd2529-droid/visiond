# PATCH v0.14.141 — Course Card Digital Catalog Style

วันที่: 2026-08-11

## ผลลัพธ์

- ปรับโครง HTML ของการ์ดคอร์สให้ใช้ card/cover/info/bottom pattern เดียวกับสินค้าดิจิทัล
- ปกคอร์สเป็นภาพเดียว 16:9 ไม่มีปุ่มซ้าย–ขวา ไม่มีเลขภาพ และไม่มี slider hooks
- ปรับราคาและปุ่มให้วางในแถบล่างของการ์ดเหมือนแคตตาล็อก
- รองรับ desktop, tablet และ mobile

## QA

- `npm run test:v014141`
- `npm run predeploy:check`
- `node scripts/source-to-ledger-recheck.mjs`
