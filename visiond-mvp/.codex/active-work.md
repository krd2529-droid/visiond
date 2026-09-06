# Active patch: TikTok Affiliate Center commission reader

- Event: PATCH_DELIVERED
- Outcome: อ่านยอดค่าคอมจริงจาก Affiliate Center แยกรายช่องและส่งเข้าแดชบอร์ด VisionD
- Preserve: หน้าค่าคอมปัจจุบัน, การรวมหลายช่อง, ข้อมูลจาก TikTok API และห้ามสร้างตัวเลขทดแทน
- Acceptance: session แยกและเข้ารหัส; อ่านยอดตามช่วงเวลา; เก็บ snapshot พร้อมเวลา; รวมยอดทุกช่อง; แจ้งเมื่อต้องเชื่อมใหม่; ระหว่างรอไอดีใหม่ให้มี collector adapter/ตัวแปรกลวงที่ไม่สร้างหรือส่งยอดสมมติ
- Phase: เพิ่มและส่งมอบ Cloud Run collector shell, configuration contract, HMAC sender และ safe-disabled behavior แล้ว; ชุดทดสอบ collector/ingest/aggregation ผ่าน
- Blocker: ตัวอ่าน Affiliate Center บน Cloud Run ต้องรับ session TikTok ของแต่ละช่องก่อนจึงจะอ่านหน้าแทนผู้ใช้ได้ และต้องทดสอบกับหน้าจริงหนึ่งช่องเพื่อยืนยันตัวเลือกข้อมูล
- Files: migration 0082, TikTok schema/commission aggregation, internal snapshot endpoint, focused regression, commission UI label
- Delivered foundation: 590f46bb on origin/main; production signed-ingest endpoint active
- Delivered shell: e14a667b on origin/main
- Next: หลังได้ไอดีใหม่จึงเปิด patch ใส่ session adapter จริงและเปิด Scheduler
