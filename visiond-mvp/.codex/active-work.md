# Active patch: Remove stale form references after direct entry

- Event: PATCH_READY
- Outcome: ช่องเดิมต้องคงแสดงโดยไม่มีข้อความแดงจาก form ที่ถูกลบ
- Preserve: เข้าแผงจัดการสินค้าตรง; ไม่มีแถบ 1/2; + ช่องใหม่เปิด TikTok OAuth
- Acceptance: selectChannel/newChannel ไม่แตะ element ที่ถูกลบ; ความผิดพลาดโหลดรายละเอียดไม่ลบการ์ดช่อง; production ไม่มี null textContent error
- Phase: stale references removed and regression suite passed; ready to deploy
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, tests
