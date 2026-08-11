# Patch v0.14.164 — V Easy LINE Diagnostics

- เก็บข้อความลูกค้าก่อนเรียก AI จึงไม่หายเมื่อ Provider ล้มเหลว
- บันทึกและล้าง `last_error` ตามผลประมวลผลจริง
- บล็อกการเริ่มบอทเมื่อ AI ยังไม่ตั้งค่า หรือ LINE webhook ยังไม่ ready
- ส่งสถานะ `ai`, `line` และ `blockers` ให้ V Easy แสดงสาเหตุได้ตรงจุด

Event Case ยังรอ Deploy และทดสอบข้อความ LINE จริง 1 ข้อความ
