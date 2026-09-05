# Active patch: TikTok Creator authorization to Showcase completion

- Event: PATCH_READY
- Outcome: เชื่อมบัญชี Creator แล้วค้นสินค้า Open Collaboration และเพิ่มเข้า Showcase ของบัญชีที่ระบุได้โดยไม่เกิดผลสำเร็จคลุมเครือ
- Acceptance: แสดงความพร้อมของ scope ก่อนกด, มีปุ่มเชื่อมสิทธิ์ใหม่โดยไม่ต้องลบ cache, ระบุบัญชีปลายทาง, แยกผลเพิ่มสำเร็จออกจากผลซิงก์, รายงานรายการที่ TikTok ปฏิเสธ
- Phase: verified
- Likely files: functions/_tiktok_shop_api.js, functions/api/admin/tiktok-connections/index.js, public/tiktok-analyzer.js, tests, visible version
- Verification: Creator capability contract PASS; callback permission status PASS; official Showcase batching and per-product error handling PASS; Marketplace UI/adversarial regressions PASS; syntax, version parity and predeploy PASS
- Delivery: pending
- Next: commit scoped files, push origin/main, verify production assets and authenticated flow as available
