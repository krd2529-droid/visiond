# Active patch: TikTok Affiliate Center commission reader

- Event: PATCH_BLOCKED
- Outcome: อ่านยอดค่าคอมจริงจาก Affiliate Center แยกรายช่องและส่งเข้าแดชบอร์ด VisionD
- Preserve: หน้าค่าคอมปัจจุบัน, การรวมหลายช่อง, ข้อมูลจาก TikTok API และห้ามสร้างตัวเลขทดแทน
- Acceptance: session แยกและเข้ารหัส; อ่านยอดตามช่วงเวลา; เก็บ snapshot พร้อมเวลา; รวมยอดทุกช่อง; แจ้งเมื่อต้องเชื่อมใหม่
- Phase: ฝั่งรับ snapshot, schema, precedence และ shared secret deploy บน production แล้ว; endpoint ปฏิเสธคำขอไร้ลายเซ็นด้วย 401 ตามคาด; focused tests ผ่าน
- Blocker: ตัวอ่าน Affiliate Center บน Cloud Run ต้องรับ session TikTok ของแต่ละช่องก่อนจึงจะอ่านหน้าแทนผู้ใช้ได้ และต้องทดสอบกับหน้าจริงหนึ่งช่องเพื่อยืนยันตัวเลือกข้อมูล
- Files: migration 0082, TikTok schema/commission aggregation, internal snapshot endpoint, focused regression, commission UI label
- Delivered foundation: 590f46bb on origin/main; production signed-ingest endpoint active
- Next: เปิด Affiliate Center และเข้าสู่ระบบช่องแรกเพื่อจับ session แล้วจึง deploy/test Cloud Run collector และ Scheduler
