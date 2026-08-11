# PATCH v0.14.151 — Cloudflare Active Tree Sync

- ตรวจพบ Repository มีโครงเว็บสองชุด: รากเป็น 150 แต่ `visiond-mvp` ที่ Cloudflare ใช้ยังเป็น 148
- ซิงก์ไฟล์ Runtime ของ 150 เข้าโครง `visiond-mvp` และขึ้นหมายเลขทั้งสองชุดเป็น 151
- ยังไม่ลบโครงใดในแพตนี้ เพื่อลดความเสี่ยงเว็บล่มระหว่างโฆษณา V5
- เพิ่ม parity test ป้องกันรากกับโครงใช้งานจริงต่างกันอีก

## Next safe cleanup phase

หลัง 151 ขึ้น Production และเส้นทาง V5 ผ่าน จึงเปลี่ยน Cloudflare Root directory จาก `visiond-mvp` ไป Repository root ก่อนกักกันโครงซ้อน การลบถาวรต้องเป็นแพตแยกหลังตรวจ Production แล้ว
