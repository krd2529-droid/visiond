# Active patch: Explicit TikTok account selection

- Event: PATCH_READY
- Outcome: เชื่อมการ์ดช่อง 2 ได้สะดวกโดย TikTok ต้องแสดงหน้าขออนุญาต ไม่เลือกบัญชี Daddy ที่ค้างอยู่ให้อัตโนมัติ
- Preserve: หนึ่งการ์ดต่อหนึ่งช่อง; state/callback ผูก channel_id เดิม; ห้ามย้ายบัญชีที่เชื่อมกับการ์ดอื่น
- Acceptance: Login Kit ส่ง disable_auto_auth=1; ปุ่มของช่องใหม่สื่อว่าต้องเลือกบัญชี; callback กลับมายังการ์ดที่เริ่มเชื่อม; ทดสอบการแยกช่องเดิมผ่าน
- Constraint: TikTok Shop Creator authorization รองรับอย่างเป็นทางการเฉพาะ app_key และ state จึงไม่ส่งพารามิเตอร์สลับบัญชีที่ไม่มีในเอกสาร
- Phase: implementation complete, delivery verification
- Likely files: functions/_tiktok_oauth.js, public/tiktok-analyzer.js, public/tiktok-analyzer.html, tests
- Verification: explicit account selection PASS; callback channel binding PASS; one-card-one-channel isolation PASS; Shop account binding PASS; OAuth regression PASS; JS syntax PASS
