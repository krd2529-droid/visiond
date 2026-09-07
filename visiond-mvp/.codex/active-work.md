# Active patch: Commission image input and social share workflow

- Event: PATCH_READY
- Outcome: เพิ่มฟอร์มชื่อและช่วงวันที่ สร้างรูปก่อน แล้วแสดงปุ่มแชร์พร้อม caption, hashtags และ VX referral link เดิมของผู้ใช้
- Preserve: ปุ่มแสดงเมื่อมีค่าคอมจริงเท่านั้น, ข้อมูลจริงจาก TikTok, แชร์หรือดาวน์โหลดได้, ไม่สร้างตัวเลขทดแทน
- Acceptance: ชื่อแก้ได้; วันที่/ช่วงวันที่เปลี่ยนแล้วโหลดข้อมูลช่วงเดียวกันก่อนวาด; รูปบันทึกคลังก่อนแสดงปุ่มแชร์; caption และ hashtags แก้ได้; referral link ใช้ API เดิมและคัดลอกได้
- Phase: implementation complete; social workflow, image library, template, referral integration, syntax, and diff checks passed
- Blocker: ไม่มี
- Files: public/tiktok-analyzer.js, public/tiktok-commission-card.js, public/tiktok-analyzer.css, tiktok-analyzer.html, regressions, FEATURE-MAP.md
- Verification: form includes owner/exact date range/caption/hashtags/referral link; changed dates reload authoritative totals before generation; share controls remain hidden until library save/cache succeeds
- Next: review branch and diff, commit relevant files, push origin/main, verify production assets
