# Active patch: TikTok Marketplace reauthorization

- Event: PATCH_STARTED
- Outcome: เมื่อ TikTok ตอบ 105005 ระบบต้องให้ต่อสิทธิ์ Marketplace ใหม่ได้ทันที แม้บัญชีจะแสดงว่าเชื่อมอยู่
- Preserve: ไม่บังคับยกเลิกบัญชี; Showcase/ออเดอร์เดิม; ปุ่มค้นหาและข้อความวินิจฉัย
- Acceptance: 105005 ถูกจัดเป็น missing scope โดยตรง; UI เปิดลิงก์ OAuth ของช่องปัจจุบันและเปลี่ยนข้อความปุ่ม; ทดสอบ regression
- Event: PATCH_DELIVERED
- Phase: committed and pushed to origin/main; production serves asset 02094
- Verification: 105005 classification/CTA tests, Marketplace search/connection/adversarial regressions, predeploy check, git diff check, production asset inspection
- Files: functions/api/admin/tiktok-connections/marketplace.js, public/tiktok-analyzer.js, public/tiktok-analyzer.html, scripts/test-tiktok-marketplace-upstream-errors.mjs
