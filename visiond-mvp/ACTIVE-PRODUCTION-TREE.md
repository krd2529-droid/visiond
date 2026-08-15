# VisionD Active Production Tree

- Cloudflare Root directory: `visiond-mvp`
- สถานะ: โฟลเดอร์ Production ถาวร ห้ามย้าย เปลี่ยนชื่อ กักกัน หรือลบ
- ทุกแพตเว็บต้องแก้และทดสอบ `visiond-mvp` โดยตรง เพราะ Cloudflare Pages Deploy จากตำแหน่งนี้
- repository root เป็น staging/mirror และต้อง sync เข้า `visiond-mvp` ก่อนส่งแพตทุกครั้ง
- ห้ามรายงานว่า Deploy สำเร็จจนกว่าจะตรวจเลขเวอร์ชันจากเว็บจริง
- การทำความสะอาดใช้รายชื่อไฟล์แบบเจาะจง ห้าม wildcard และต้องมีคำสั่งย้อนคืนเมื่อเป็นไฟล์ที่ไม่ยืนยันว่าซ้ำ
