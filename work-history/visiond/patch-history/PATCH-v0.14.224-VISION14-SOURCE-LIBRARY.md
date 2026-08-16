# v0.14.224 — Vision 14 Source Library + Rights Gate

## เปลี่ยนอะไร

- เปิด Event Case Vision 14 และสร้างแพตแรกเป็นคลัง PDF ต้นฉบับจริง
- เพิ่ม Rights Gate ห้าสถานะ โดยรายการอ้างอิงอย่างเดียวถูกล็อกการขาย
- เพิ่มทางเข้าจากหลังบ้าน พร้อม UI มือถือและสถานะการบันทึก/ข้อผิดพลาด

## ข้อควรระวัง

- แพตนี้ยังไม่ถอดข้อความ ไม่สรุป และไม่สร้าง E-book
- สถานะสิทธิ์เป็นด่านควบคุม Workflow ไม่ใช่คำรับรองทางกฎหมายอัตโนมัติ
- Rollback แบบไม่ทำลายประวัติ: `git revert <commit-v0.14.224>` แล้วทดสอบใหม่ ให้ Boss เป็นผู้ Push/Deploy

## Event Case

`CONTINUE NEXT PATCH` — ทำ Text Extraction ที่ผูกกลับเลขหน้าและ Identity/Credit Cleaner ต่อเป็นลำดับแรก
