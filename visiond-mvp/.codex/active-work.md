# Active patch: VX affiliate commission payout billing

- Event: PATCH_DELIVERED
- Outcome: VisionD ออกเอกสารสรุปการจ่ายค่าคอมจากรอบจ่ายจริง ให้ลูกค้าตรวจยอดขายเต็ม เปอร์เซ็นต์ค่าคอม และยอดค่าคอมได้
- Preserve: รอบจ่ายวันที่ 1 และ cutoff เวลาไทย; ตัวเลขจาก ledger จริงเท่านั้น; สิทธิ์ลูกค้าเห็นเฉพาะเอกสารของตน; Boss เห็นได้เพื่อดำเนินการจ่าย; ระบบใบเสร็จเดิมไม่เปลี่ยน
- Acceptance: payout API ตรวจ owner/Boss; เอกสารแสดงเลขที่รอบ ผู้รับ สถานะ รายการขาย ยอดเต็ม อัตรา ค่าคอมต่อรายการ และยอดรวมค่าคอมทั้งหมด; ผลรวมตรง payout ledger; ลูกค้าและหน้า admin มีทางเข้า; พิมพ์/บันทึก PDF ได้
- Phase: delivered to production; implementation, regressions, push, and production checks passed
- Blocker: ไม่มี
- Files: functions/api/vx/referrals.js, functions/api/vx/payouts/[id].js, public/vx-affiliate.*, public/vx-affiliate-admin.*, public/vx-commission-statement.*, focused regression, FEATURE-MAP.md
- Verification: owner access, cross-user denial, ledger mismatch rejection, totals/rates, monthly cutoff regression, syntax, and diff checks pass
- Delivered: 4d1bfdda on origin/main; customer entry, statement fields, client link, and anonymous 401 verified on production
- Next: เมื่อสร้างรอบจ่าย ลูกค้าเปิด “เอกสารค่าคอมของฉัน” เพื่อดูรายการและบันทึก PDF ได้
