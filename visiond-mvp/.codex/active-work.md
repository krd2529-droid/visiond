# Active patch: Commission image preview

- Event: PATCH_DELIVERED
- Outcome: หลังสร้างรูปค่าคอมให้แสดงภาพเทมเพลตที่ใส่ยอดจริงแล้วบนหน้าค่าคอมก่อนแชร์
- Preserve: ปุ่มแสดงเมื่อมีค่าคอมจริงเท่านั้น, ข้อมูลจริงจาก TikTok, แชร์หรือดาวน์โหลดได้, ไม่สร้างตัวเลขทดแทน
- Acceptance: แสดง preview ครบทุกไฟล์ของชุด; ใช้ไฟล์เดียวกับที่บันทึก/แชร์; รองรับชุด cache เดิม; ไม่สร้างเลขปลอม; คืน object URL เก่าเมื่อสร้างใหม่
- Phase: delivered to production; preview, cached/generated file parity, memory cleanup, responsive CSS, push, and production checks passed
- Blocker: ไม่มี
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, tiktok-analyzer.html, focused regression, FEATURE-MAP.md
- Verification: preview renders every prepared file, uses the same File objects as sharing, revokes prior object URLs, and production page/assets expose the new gallery
- Delivered: 345b2afb on origin/main; production page 02121 and CSS 02093 verified
- Next: กดสร้างรูปในหน้าค่าคอมเพื่อเห็นรูปที่ใส่ยอดจริงทุกหน้าก่อนแชร์
