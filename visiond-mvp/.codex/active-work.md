# Active patch: VX affiliate commission payout billing

- Event: PATCH_READY
- Outcome: VisionD ออกเอกสารสรุปการจ่ายค่าคอมจากรอบจ่ายจริง ให้ลูกค้าตรวจยอดขายเต็ม เปอร์เซ็นต์ค่าคอม และยอดค่าคอมได้
- Preserve: รอบจ่ายวันที่ 1 และ cutoff เวลาไทย; ตัวเลขจาก ledger จริงเท่านั้น; สิทธิ์ลูกค้าเห็นเฉพาะเอกสารของตน; Boss เห็นได้เพื่อดำเนินการจ่าย; ระบบใบเสร็จเดิมไม่เปลี่ยน
- Acceptance: payout API ตรวจ owner/Boss; เอกสารแสดงเลขที่รอบ ผู้รับ สถานะ รายการขาย ยอดเต็ม อัตรา ค่าคอมต่อรายการ และยอดรวมค่าคอมทั้งหมด; ผลรวมตรง payout ledger; ลูกค้าและหน้า admin มีทางเข้า; พิมพ์/บันทึก PDF ได้
- Phase: implementation complete; delivery in progress
- Blocker: ไม่มี
- Files: functions/api/vx/referrals.js, functions/api/vx/payouts/[id].js, public/vx-affiliate.*, public/vx-affiliate-admin.*, public/vx-commission-statement.*, focused regression, FEATURE-MAP.md
- Verification: owner access, cross-user denial, ledger mismatch rejection, totals/rates, monthly cutoff regression, syntax, and diff checks pass
- Next: inspect final diff, commit relevant files, push origin main, and verify production assets
