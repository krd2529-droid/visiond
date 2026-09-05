# Active patch: TikTok Marketplace reauthorization

- Event: PATCH_STARTED
- Outcome: เมื่อ TikTok ตอบ 105005 ระบบต้องให้ต่อสิทธิ์ Marketplace ใหม่ได้ทันที แม้บัญชีจะแสดงว่าเชื่อมอยู่
- Preserve: ไม่บังคับยกเลิกบัญชี; Showcase/ออเดอร์เดิม; ปุ่มค้นหาและข้อความวินิจฉัย
- Acceptance: 105005 ถูกจัดเป็น missing scope โดยตรง; UI เปิดลิงก์ OAuth ของช่องปัจจุบันและเปลี่ยนข้อความปุ่ม; ทดสอบ regression
- Event: PATCH_READY
- Phase: 105005 reauthorization CTA implemented; focused and predeploy tests passed; pending commit, push, and production verification of asset 02094
- Files: functions/api/admin/tiktok-connections/marketplace.js, public/tiktok-analyzer.js, public/tiktok-analyzer.html, scripts/test-tiktok-marketplace-upstream-errors.mjs
