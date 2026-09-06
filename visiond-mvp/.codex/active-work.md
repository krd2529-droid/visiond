# Active patch: TikTok commission collector readiness

- Event: PATCH_DELIVERED
- Outcome: ทำส่วนที่ไม่ต้องรอไอดี TikTok ให้พร้อม ได้แก่สถานะรายช่อง, session reference, retry/error report และหน้าแสดงความพร้อม
- Preserve: หน้าค่าคอมปัจจุบัน, การรวมหลายช่อง, ข้อมูลจาก TikTok API และห้ามสร้างตัวเลขทดแทน
- Acceptance: session แยกและเข้ารหัส; อ่านยอดตามช่วงเวลา; เก็บ snapshot พร้อมเวลา; รวมยอดทุกช่อง; แจ้งเมื่อต้องเชื่อมใหม่; ระหว่างรอไอดีใหม่ให้มี collector adapter/ตัวแปรกลวงที่ไม่สร้างหรือส่งยอดสมมติ
- Phase: schema/API/UI และ collector lifecycle ส่งขึ้น production แล้ว; focused + regression checks ผ่าน 9 รายการ; production status endpoint ปฏิเสธคำขอไร้ลายเซ็น 401 ตามคาด
- Blocker: ตัวอ่าน Affiliate Center บน Cloud Run ต้องรับ session TikTok ของแต่ละช่องก่อนจึงจะอ่านหน้าแทนผู้ใช้ได้ และต้องทดสอบกับหน้าจริงหนึ่งช่องเพื่อยืนยันตัวเลือกข้อมูล
- Files: migration 0082, TikTok schema/commission aggregation, internal snapshot endpoint, focused regression, commission UI label
- Delivered foundation: 590f46bb on origin/main; production signed-ingest endpoint active
- Delivered shell: e14a667b on origin/main
- Delivered: 417bc928 on origin/main
- Next: adapter จริงกับการเปิด Scheduler ยังคงรอไอดีใหม่และ session จริงหนึ่งช่อง
