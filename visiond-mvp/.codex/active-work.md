# Active patch: Commission card pages of 10 channels

- Event: PATCH_READY
- Outcome: สร้างรูปค่าคอมเป็นชุด หน้าละไม่เกิน 10 ช่อง โดยใช้ยอดรวมทุกช่องยอดเดียวกันบนทุกภาพ
- Preserve: ปุ่มแสดงเมื่อมีค่าคอมจริงเท่านั้น, ข้อมูลจริงจาก TikTok, แชร์หรือดาวน์โหลดได้, ไม่สร้างตัวเลขทดแทน
- Acceptance: ภาพ 1080x1350; สองคอลัมน์ช่อง 1–5 และ 6–10; เลขช่องต่อเนื่องในหน้าถัดไป; ยอดรวมทุกช่องไม่ถูกคำนวณใหม่รายหน้า; แสดงช่วงวันที่เริ่มต้น–สิ้นสุดที่เลือก; แชร์/ดาวน์โหลดไฟล์ครบทุกหน้า
- Phase: implementation complete; focused regressions and syntax checks passed; delivery in progress
- Blocker: ไม่มี
- Files: public/tiktok-commission-card.js, public/tiktok-analyzer.js, scripts/test-tiktok-commission-card-template.mjs, FEATURE-MAP.md
- Verification: 23 channels produce 3 images with continuous numbering; every image repeats the same all-channel total and selected date range; commission integration regression passed
- Next: commit relevant files and push origin/main
