# Active patch: VX referral monthly payout cutoff

- Event: PATCH_READY
- Outcome: รอบจ่ายวันที่ 1 ใช้ค่าคอมจากยอดชำระเต็มที่เกิดก่อนวันที่ 1; ยอดตั้งแต่วันที่ 1 เข้ารอบถัดไป
- Preserve: ปุ่มแสดงเมื่อมีค่าคอมจริงเท่านั้น, ข้อมูลจริงจาก TikTok, แชร์หรือดาวน์โหลดได้, ไม่สร้างตัวเลขทดแทน
- Acceptance: คำนวณ amount จาก base_amount เต็มตาม rate เดิม; cutoff ใช้วันชำระ order เวลาไทยก่อนต้นเดือน; รายการวันที่ 1 ไม่เข้ารอบปัจจุบัน; สร้าง payout ไม่สามารถข้าม cutoff; คง approval/proof/refund controls
- Phase: implementation complete; Bangkok cutoff, full-base calculation, payout enforcement, UI copy, syntax, and regression checks passed
- Blocker: ไม่มี
- Files: functions/api/admin/vx-referrals.js, public/vx-affiliate-admin.js, referral regression, FEATURE-MAP.md
- Verification: cutoff appears in automatic payable transition, manual payable transition, and payout creation; base_amount × rate remains authoritative; admin page explains the monthly rule
- Next: commit relevant files, push origin/main, verify production API and admin assets
