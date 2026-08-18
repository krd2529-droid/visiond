# v0.14.159 — Integrity Timeout Recovery

- ยืนยันจาก Production 158 ว่าหน้า Integrity และ API โดยตรงยังรอไม่จบ
- ข้าม schema initializer เฉพาะด่าน Event Case ที่อ่านอย่างเดียว
- จำกัดเวลาฐานข้อมูล 5 วินาทีและหน้าเว็บ 8 วินาที โดย fail closed เสมอ
