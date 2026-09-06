# Active patch: TikTok Affiliate Center commission reader

- Event: PATCH_READY
- Outcome: อ่านยอดค่าคอมจริงจาก Affiliate Center แยกรายช่องและส่งเข้าแดชบอร์ด VisionD
- Preserve: หน้าค่าคอมปัจจุบัน, การรวมหลายช่อง, ข้อมูลจาก TikTok API และห้ามสร้างตัวเลขทดแทน
- Acceptance: session แยกและเข้ารหัส; อ่านยอดตามช่วงเวลา; เก็บ snapshot พร้อมเวลา; รวมยอดทุกช่อง; แจ้งเมื่อต้องเชื่อมใหม่
- Phase: ฝั่งรับ snapshot, schema, precedence และ shared secret พร้อม deploy; focused tests ผ่าน
- Blocker: ตัวอ่าน Affiliate Center บน Cloud Run ยังต้องรับ session TikTok ของแต่ละช่องก่อนจึงจะอ่านหน้าแทนผู้ใช้ได้
- Files: migration 0082, TikTok schema/commission aggregation, internal snapshot endpoint, focused regression, commission UI label
- Next: deploy ingestion layer แล้วทำ session onboarding รายช่องและ Cloud Run collector ต่อ
