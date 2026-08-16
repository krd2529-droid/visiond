# v0.14.226 — Vision 14 Automatic PDF Extraction + OCR Retry

- อ่าน Text Layer ด้วย PDF.js ใน Browser ของ Boss
- OCR เฉพาะหน้าสแกนผ่าน Backend และ Secret Cloudflare
- เก็บผลสำเร็จ/ค้าง/ผิดพลาดรายหน้า พร้อม Retry เฉพาะหน้าค้าง
- Event Case ต่อไป: สรุปเต็มและ PDF สอนของจาวิส
- Rollback: `git revert <commit-v0.14.226>`; Boss Push/Deploy เท่านั้น
