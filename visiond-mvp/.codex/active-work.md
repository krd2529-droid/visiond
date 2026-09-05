# Active patch: TikTok Creator authorization to Showcase completion

- Event: PATCH_DELIVERED
- Outcome: เชื่อมบัญชี Creator แล้วค้นสินค้า Open Collaboration และเพิ่มเข้า Showcase ของบัญชีที่ระบุได้โดยไม่เกิดผลสำเร็จคลุมเครือ
- Acceptance: แสดงความพร้อมของ scope ก่อนกด, มีปุ่มเชื่อมสิทธิ์ใหม่โดยไม่ต้องลบ cache, ระบุบัญชีปลายทาง, แยกผลเพิ่มสำเร็จออกจากผลซิงก์, รายงานรายการที่ TikTok ปฏิเสธ
- Phase: deployed_pending_external_verification
- Likely files: functions/_tiktok_shop_api.js, functions/api/admin/tiktok-connections/index.js, public/tiktok-analyzer.js, tests, visible version
- Verification: Creator capability contract PASS; callback permission status PASS; official Showcase batching and per-product error handling PASS; Marketplace UI/adversarial regressions PASS; syntax, version parity and predeploy PASS; production serves v0.20.31 desktop/mobile with no console errors; authenticated Creator OAuth and real Showcase mutation await account login and TikTok scope approval
- Delivery: v0.20.31, commit 6055c4d7, pushed to origin/main and served on production
- Next: owner enables/approves creator scopes, signs in, reconnects Creator, then performs one real Marketplace-to-Showcase acceptance test
