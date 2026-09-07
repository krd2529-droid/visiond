# Active patch: TikTok Reviewer Login Reliability

- Event: PATCH_READY
- Outcome: ผู้ตรวจ TikTok ที่ยังไม่ล็อกอินต้องถูกพาไปหน้าเข้าสู่ระบบและกลับเข้า VX ได้ทันที โดย login ไม่ทำ schema DDL หรือ telemetry หนักในเส้นทางตอบกลับ
- Acceptance: guest เปิด `/tiktok-analyzer.html` แล้วไป login พร้อม return path; login สำเร็จกลับหน้า analyzer; 401/403/503 แสดงสถานะถูกต้อง; ไม่มี review demo/ข้อมูลปลอม/การข้ามสิทธิ์ VX; ชุดทดสอบ auth และ TikTok เดิมผ่าน
- Preserved: การตรวจรหัสผ่าน, rate limit, one-session policy, active VX requirement, TikTok OAuth และสิทธิ์ข้อมูลจริง
- Root cause: D1 daily limit ทำให้ rate-limit query throw เป็น `[AUTH-LOGIN]`; analyzer เรียก private API ทันทีแต่ไม่มี auth bootstrap/return path; login รัน Vision7 DDL และ telemetry ก่อนตอบสำเร็จ
- Phase: implementation and local verification complete
- Files changed: public/tiktok-analyzer.js, functions/api/auth/login.js, VERSION.txt, public/index.html, public/admin.html, package.json, focused regression tests
- Production blocker: D1 quota ปัจจุบันยังเต็ม; ต้องรอ reset เพื่อทดสอบบัญชี reviewer จริง end-to-end
- Verification: syntax PASS; v0.20.55 reviewer login PASS; ฐ1 catalog regressions PASS; visible version parity PASS; predeploy PASS 9 / WARN 8 / FAIL 0; historical v0.20.48 test has a pre-existing stale grade-label assertion unrelated to this patch
- Next action: commit/push and verify deployed static reviewer flow; real reviewer credential/VX gate remains after D1 resets at 2026-09-08 07:00 Asia/Bangkok
