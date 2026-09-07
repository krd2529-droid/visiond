# Active patch: Commission card pages of 10 channels

- Event: PATCH_DELIVERED
- Outcome: สร้างรูปค่าคอมเป็นชุด หน้าละไม่เกิน 10 ช่อง โดยใช้ยอดรวมทุกช่องยอดเดียวกันบนทุกภาพ
- Preserve: ปุ่มแสดงเมื่อมีค่าคอมจริงเท่านั้น, ข้อมูลจริงจาก TikTok, แชร์หรือดาวน์โหลดได้, ไม่สร้างตัวเลขทดแทน
- Acceptance: ภาพ 1080x1350; สองคอลัมน์ช่อง 1–5 และ 6–10; เลขช่องต่อเนื่องในหน้าถัดไป; ยอดรวมทุกช่องไม่ถูกคำนวณใหม่รายหน้า; แสดงช่วงวันที่เริ่มต้น–สิ้นสุดที่เลือก; แชร์/ดาวน์โหลดไฟล์ครบทุกหน้า
- Phase: delivered to production; focused regressions, syntax checks, push, and production asset verification passed
- Blocker: ไม่มี
- Files: public/tiktok-commission-card.js, public/tiktok-analyzer.js, scripts/test-tiktok-commission-card-template.mjs, FEATURE-MAP.md
- Verification: 23 channels produce 3 images with continuous numbering; every image repeats the same all-channel total and selected date range; commission integration regression passed
- Delivered: 5bce1b2e on origin/main; production asset v02089 verified
- Next: ผู้ใช้เลือกช่วงวันที่ในหน้าค่าคอมแล้วกดสร้างรูปและแชร์เพื่อรับภาพชุดหน้าละ 10 ช่อง
