# Vision 5 Backup & Restore

ตั้งค่า `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` และติดตั้งแพ็กเกจก่อนใช้งาน

- สำรอง: `npm run vision5:backup -- D:\visiond-backups\รอบ-01`
- ตรวจชุดสำรองโดยไม่กู้จริง: `npm run vision5:restore -- D:\visiond-backups\รอบ-01`
- กู้จริง: ตั้ง `VISIOND_RESTORE_CONFIRM=RESTORE_VISION5` แล้วรันคำสั่งเดิมต่อท้าย `--apply`

ชุดสำรองประกอบด้วย D1 SQL, ไฟล์ R2 ทั้งหมด และ `manifest.json` พร้อม SHA-256 ของทุกไฟล์ ควรทดสอบกู้คืนในฐานข้อมูลและ bucket ทดสอบก่อนระบบจริงเสมอ
