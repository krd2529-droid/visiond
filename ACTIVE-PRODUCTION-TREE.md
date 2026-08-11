# VisionD Active Production Tree

- Cloudflare Root directory: `visiond-mvp`
- สถานะ: โฟลเดอร์ Production ถาวร ห้ามย้าย เปลี่ยนชื่อ กักกัน หรือลบ
- ทุกแพตเว็บต้องแก้และทดสอบ `visiond-mvp` โดยตรง
- ไฟล์นอก `visiond-mvp` ต้องผ่านการเทียบกับ Active tree ก่อนกักกันหรือลบ
- การทำความสะอาดใช้รายชื่อไฟล์แบบเจาะจง ห้าม wildcard และต้องมีคำสั่งย้อนคืนเมื่อเป็นไฟล์ที่ไม่ยืนยันว่าซ้ำ
