# Patch Work Ledger — ตัวกันงานหลุดภายในแพต

ระบบนี้ครอบคลุมงานทุกชนิดในแพต ไม่จำกัด ELON หรือ Event Case:

- FEATURE — ฟีเจอร์
- BUG — แก้บั๊ก
- SECURITY — ความปลอดภัย
- DATABASE — schema/migration/data integrity
- UI — หน้าเว็บและมือถือ
- CONFIG — Secret/config/deploy requirement
- QA — การทดสอบ
- DOC — Roadmap, Ledger และคู่มือ

ก่อนเริ่มแพต ต้องสร้าง `patch-ledgers/vX.Y.Z.json` และแยกทุกคำสั่ง/งานย่อยเป็นรหัส ห้ามรวมเป็นคำกว้าง หลังทำเสร็จต้องผูกไฟล์หลักฐานทุกข้อ จากนั้นรัน `npm run patch:coverage` หากงานย่อยใดหาย ไม่มีหลักฐาน หรือเป็น MISSING/UNCERTAIN ห้ามสร้าง ZIP

ลำดับตรวจบังคับก่อนส่งคือ:

1. Patch Work Coverage — จับงานย่อยที่หลุดภายในแพตปัจจุบัน
2. Requirement Coverage — จับคำสั่ง Event Case ที่หายจาก Ledger
3. Cross-Patch Snapshot Recheck — จับงานจากแพตก่อนที่ถูกลบหรือเปลี่ยนย้อนหลัง
4. Tests + Predeploy — ตรวจว่าโค้ดและไฟล์ทำงานได้
