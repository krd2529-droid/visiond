# Active patch: Commission image preview

- Event: PATCH_STARTED
- Outcome: หลังสร้างรูปค่าคอมให้แสดงภาพเทมเพลตที่ใส่ยอดจริงแล้วบนหน้าค่าคอมก่อนแชร์
- Preserve: ปุ่มแสดงเมื่อมีค่าคอมจริงเท่านั้น, ข้อมูลจริงจาก TikTok, แชร์หรือดาวน์โหลดได้, ไม่สร้างตัวเลขทดแทน
- Acceptance: แสดง preview ครบทุกไฟล์ของชุด; ใช้ไฟล์เดียวกับที่บันทึก/แชร์; รองรับชุด cache เดิม; ไม่สร้างเลขปลอม; คืน object URL เก่าเมื่อสร้างใหม่
- Phase: implementation
- Blocker: ไม่มี
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, tiktok-analyzer.html, focused regression, FEATURE-MAP.md
- Next: render generated/cached commission files as previews and verify responsive layout
