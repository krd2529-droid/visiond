# PATCH v0.14.334 — Automated Patch Gate

- เพิ่ม `npm run patch:gate` สำหรับรัน staged-file, focused, visible-version, regression และ predeploy ตามลำดับ
- หยุดทันทีเมื่อไม่มี staged files หรือพบ `.pnpm-store`, ไฟล์ลับ และไฟล์นอกขอบเขต repo ที่อนุญาต
- Gate อ่านอย่างเดียว ไม่ Push และไม่ Deploy

`EVENT CASE: เสร็จทั้งหมดแล้ว — พร้อมรับ Event Case ใหม่`
