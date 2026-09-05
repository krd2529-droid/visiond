# Active patch: TikTok daily commission availability

- Event: PATCH_STARTED
- Outcome: ดึงยอดออเดอร์/ค่าคอมได้ตั้งแต่ 12:00 เวลาไทย และได้ล่าสุดถึงเมื่อวานเท่านั้น
- Preserve: โหลด Showcase ได้ตลอดวัน; เปิดดูข้อมูลที่ซิงก์ไว้แล้วได้; หนึ่งการ์ดต่อหนึ่งช่อง
- Acceptance: ก่อน 12:00 API ปฏิเสธ order sync ของเมื่อวานพร้อมบอกให้รอ 12:00; หลัง 12:00 sync เมื่อวานได้; วันที่สิ้นสุดสูงสุดเป็นเมื่อวานตลอดวัน; API clamp วันที่วันนี้/อนาคต; UI ใช้กติกาเดียวกัน
- Event: PATCH_DELIVERED
- Requirement correction: วันที่เป้าหมายต้องเป็นเมื่อวานเสมอ; ก่อน 12:00 ให้รอยอดเมื่อวาน ไม่ถอยวันล่าสุดไปเป็นสองวันก่อน
- Phase: correction implemented, verified, and ready on main
- Verification: boundary tests at 11:59:59/12:00:00, date clamping, syntax, commission/VX regression, OAuth channel isolation, visible-version parity, and predeploy check passed
- Gate note: legacy test-v014492 still expects removed `shop_remove_f` behavior and is unrelated to this patch
- Files: functions/_tiktok_commission.js, functions/api/admin/tiktok-connections/index.js, public/tiktok-analyzer.js/html, focused tests, feature map
