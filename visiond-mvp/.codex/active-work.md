# Active patch: TikTok Reviewer Login Reliability

- Event: PATCH_BLOCKED
- Outcome: ผู้ตรวจ TikTok ที่ยังไม่ล็อกอินต้องถูกพาไปหน้าเข้าสู่ระบบและกลับเข้า VX ได้ทันที โดย login ไม่ทำ schema DDL หรือ telemetry หนักในเส้นทางตอบกลับ
- Acceptance: guest เปิด `/tiktok-analyzer.html` แล้วไป login พร้อม return path; login สำเร็จกลับหน้า analyzer; 401/403/503 แสดงสถานะถูกต้อง; ไม่มี review demo/ข้อมูลปลอม/การข้ามสิทธิ์ VX; ชุดทดสอบ auth และ TikTok เดิมผ่าน
- Preserved: การตรวจรหัสผ่าน, rate limit, one-session policy, active VX requirement, TikTok OAuth และสิทธิ์ข้อมูลจริง
- Root cause: D1 daily limit ทำให้ rate-limit query throw เป็น `[AUTH-LOGIN]`; analyzer เรียก private API ทันทีแต่ไม่มี auth bootstrap/return path; login รัน Vision7 DDL และ telemetry ก่อนตอบสำเร็จ
- Phase: deployed; full reviewer-account verification blocked by Cloudflare D1 daily quota
- Files changed: public/tiktok-analyzer.js, functions/api/auth/login.js, VERSION.txt, public/index.html, public/admin.html, package.json, focused regression tests
- Production blocker: D1 quota ปัจจุบันยังเต็ม; ต้องรอ reset เพื่อทดสอบบัญชี reviewer จริง end-to-end
- Verification: syntax PASS; v0.20.55 reviewer login PASS; ฐ1 catalog regressions PASS; visible version parity PASS; predeploy PASS 9 / WARN 8 / FAIL 0; production serves WEB v0.20.55 and a clean browser opening `/tiktok-analyzer.html` redirects to `/login` correctly; historical v0.20.48 test has a pre-existing stale grade-label assertion unrelated to this patch
- Delivery: commit 7639ff33 pushed to origin/main and deployed to production
- Blocker: D1 resets at 2026-09-08 07:00 Asia/Bangkok; only then can reviewer credentials, `vd_session`, active VX, and `/api/admin/tiktok-analyzer` be verified end-to-end
- Next action: after reset, run the real reviewer login/VX gate; do not resubmit TikTok review before it passes
