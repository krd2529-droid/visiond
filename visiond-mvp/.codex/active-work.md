# Active patch: Per-user commission image library

- Event: PATCH_DELIVERED
- Outcome: บันทึกภาพค่าคอมเข้าคลังของผู้ใช้และใช้ชุดเดิมเมื่อเรียกช่วงวันที่เดิมกับข้อมูลเดิม
- Preserve: ปุ่มแสดงเมื่อมีค่าคอมจริงเท่านั้น, ข้อมูลจริงจาก TikTok, แชร์หรือดาวน์โหลดได้, ไม่สร้างตัวเลขทดแทน
- Acceptance: cache key แยกผู้ใช้และ exact date range; 1–15 ก.ย. ไม่ชน 14 ก.ย.; ข้อมูลเปลี่ยนสร้างชุดใหม่; ไฟล์ private; แชร์/ดาวน์โหลดพฤติกรรมเดิม
- Phase: delivered to production; focused regressions, push, asset verification, and private API authentication check passed
- Blocker: ไม่มี
- Files: migration 0084, commission-card API and private file route, public/tiktok-commission-card.js, public/tiktok-analyzer.js, regression tests, FEATURE-MAP.md
- Verification: exact date-range and user isolation asserted; changed-data fingerprint invalidation asserted; private ownership route and existing 10-channel template regressions passed
- Delivered: bdbc5960 on origin/main; production asset v02090 and authenticated library endpoint verified
- Next: เลือกช่วงวันที่แล้วกดสร้างรูป; ช่วงและข้อมูลเดิมใช้ชุดในคลัง ส่วนช่วงหรือยอดต่างกันสร้างชุดใหม่
