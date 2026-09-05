# Active patch: TikTok Marketplace upstream diagnostics

- Event: PATCH_STARTED
- Outcome: ร้านค้า/สินค้า Marketplace ที่ค้นหาไม่สำเร็จต้องแสดงสาเหตุจาก TikTok ที่นำไปแก้ได้ ไม่ใช่ HTTP 502 เปล่า ๆ
- Preserve: ปุ่มค้นหาเรียก API ได้เสมอ; การค้นหา Showcase และการให้เกรด; ขอบเขตสิทธิ์เดิม
- Acceptance: backend จำแนก scope/token/timeout/rate-limit/upstream; response มี request ID เมื่อ TikTok ส่งมา; UI แสดงรายละเอียดแบบปลอดภัย; มี regression tests
- Event: PATCH_READY
- Phase: upstream error metadata and actionable UI diagnostics implemented; focused and predeploy tests passed; pending commit, push, and production verification of asset 02093
- Files: functions/_tiktok_shop_api.js, functions/api/admin/tiktok-connections/marketplace.js, public/tiktok-analyzer.js, public/tiktok-analyzer.html, scripts/test-tiktok-marketplace-upstream-errors.mjs
