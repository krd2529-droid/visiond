# PATCH v0.14.151 — Cloudflare Active Tree Sync

- ตรวจพบ Repository มีโครงเว็บสองชุด: รากเป็น 150 แต่ `visiond-mvp` ที่ Cloudflare ใช้ยังเป็น 148
- ซิงก์ไฟล์ Runtime ของ 150 เข้าโครง `visiond-mvp` และขึ้นหมายเลขทั้งสองชุดเป็น 151
- ยังไม่ลบโครงใดในแพตนี้ เพื่อลดความเสี่ยงเว็บล่มระหว่างโฆษณา V5
- เพิ่ม parity test ป้องกันรากกับโครงใช้งานจริงต่างกันอีก

## Permanent production rule

คง Cloudflare Root directory ที่ `visiond-mvp` ถาวร ทุกแพตต้องซ่อมและทดสอบโฟลเดอร์นี้โดยตรง การทำความสะอาด Repository ทำได้เฉพาะรอบนอกและต้องไม่เปลี่ยนการตั้งค่า Cloudflare
