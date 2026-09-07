# Active patch: Daily SEO Sales Pages

- Event: PATCH_STARTED
- Outcome: สร้างเซลเพจ SEO จากสินค้าจริงอัตโนมัติวันละ 5 หน้า
- Acceptance: รันวันละครั้งตามเวลาไทย; ไม่สร้างซ้ำเมื่อ Worker retry; ใช้เฉพาะสินค้าที่ published และไม่ถูกลบ; หน้าใหม่ผ่าน quality gateและเผยแพร่พร้อม canonical/structured data/sitemap; ลิงก์ซื้อชี้หน้าสินค้าจริง; ไม่มีราคา รีวิว หรือสถิติที่แต่งขึ้น
- Phase: verified locally; delivery pending
- Files: functions/_daily_seo.js, functions/api/internal/daily-seo-pages.js, functions/_sales_pages.js, migrations/0085_daily_seo_runs.sql, workers/maintenance/*, tests, docs, VERSION.txt
- Verification: daily SEO limit/idempotency PASS; maintenance Worker PASS; manuals regression PASS; visible version parity PASS; syntax and diff checks PASS. Historical v0.14.234/v0.14.476 tests only fail their obsolete hard-coded version assertions.
- Delivery: pending commit and push to origin/main
