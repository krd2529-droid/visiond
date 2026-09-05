# Active patch: VX commissions, sharing, and user affiliate

- Event: PATCH_DELIVERED
- Outcome: ทำระบบค่าคอม TikTok แยกช่อง/รวมทุกช่องตามวันหรือช่วงเวลา, สร้างรูปและแชร์, พร้อมระบบ Affiliate VX ของผู้ใช้ที่คิดค่าคอม 20%
- Preserve: หนึ่งการ์ดต่อหนึ่งช่อง; ตัวเลขเงินต้องมาจากข้อมูลจริง; ไม่เรียก TikTok ใหม่ทุกครั้งที่เปิดดู; พักการทดสอบ OAuth ไอดี 2 โดยไม่ลดขอบเขตหลายช่อง
- Acceptance: เลือกวัน/ช่วงและปุ่มลัด 7/30 วัน; ยอดรายวันและรวมสกุลเงินอย่างถูกต้อง; รูปแชร์ระบุเจ้าของ/ช่วง/ยอดและแนบ referral URL; referral attribution ป้องกัน self/duplicate; purchase creates pending 20%; refund/cancel reverses; user/admin ledgers and payout states; tests cover multi-channel fixtures
- Constraint: production verification with a second real Creator remains deferred until Sandbox target access is added; implementation must be fully testable with isolated fixtures meanwhile
- Event: PATCH_UPDATED
- Phase: implementation and independent final audit complete
- Evidence: targeted VX/TikTok tests, channel-binding regression, syntax checks, predeploy check, and localhost browser verification of user affiliate page passed
- Gate note: focused/visible/predeploy passed; global regression has one pre-existing unrelated blog.html stylesheet assertion failure
- Deferred only: real TikTok Sandbox/OAuth login for channel 2; no other feature or multi-channel acceptance criterion is deferred
- Likely files: migrations, functions/_schema.js, TikTok connection API/UI, referral endpoints, admin/user UI, tests, roadmap
