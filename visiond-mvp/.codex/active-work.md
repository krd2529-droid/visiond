# Active patch: Daily SEO Sales Pages

- Event: PATCH_DELIVERED
- Outcome: สร้างเซลเพจ SEO จากสินค้าจริงอัตโนมัติวันละ 5 หน้า
- Acceptance: รันวันละครั้งตามเวลาไทย; ไม่สร้างซ้ำเมื่อ Worker retry; ใช้เฉพาะสินค้าที่ published และไม่ถูกลบ; หน้าใหม่ผ่าน quality gateและเผยแพร่พร้อม canonical/structured data/sitemap; ลิงก์ซื้อชี้หน้าสินค้าจริง; ไม่มีราคา รีวิว หรือสถิติที่แต่งขึ้น
- Phase: delivered to production
- Files: functions/_daily_seo.js, functions/api/internal/daily-seo-pages.js, functions/_sales_pages.js, migrations/0085_daily_seo_runs.sql, workers/maintenance/*, tests, docs, VERSION.txt
- Verification: daily SEO limit/idempotency PASS; maintenance Worker PASS; manuals regression PASS; visible version parity PASS; syntax and diff checks PASS. Historical v0.14.234/v0.14.476 tests only fail their obsolete hard-coded version assertions.
- Delivery: commit c6608692 pushed to origin/main; Pages production reports WEB v0.20.51; daily endpoint returns expected GET 405; sitemap returns valid XML; visiond-maintenance Worker deployed as fbd9a69d-aa0d-44fa-8c03-213a74b06b18 with cron 17 18 * * * and all required secrets configured
