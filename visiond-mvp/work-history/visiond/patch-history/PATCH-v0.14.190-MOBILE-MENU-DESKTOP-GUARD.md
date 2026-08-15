# PATCH v0.14.190 — ปุ่มเมนูเฉพาะมือถือ

- ซ่อนปุ่มเมนูบน desktop และแสดงเฉพาะ viewport ไม่เกิน 800px
- ยกเว้นปุ่มเปิดเมนูและ backdrop จาก runtime ปุ่มมาตรฐานเพื่อไม่ให้ display ถูกทับ
- บันทึกเป็นกฎถาวรใน Roadmap/Protocol ทุกคิวงาน รวมเว็บไซต์ 2
- Boss/Admin dashboard ซ่อน member sidebar, mobile account menu และ customer notification cards พร้อมขยาย workspace เป็นคอลัมน์เดียว
- ไม่มี Push/Deploy; ย้อนกลับด้วย `git revert SELF`
