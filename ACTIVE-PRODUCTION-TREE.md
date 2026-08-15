# VisionD Active Production Tree

- Cloudflare Root directory: `/` (repository root)
- สถานะ: โฟลเดอร์ Production ถาวร ห้ามย้าย เปลี่ยนชื่อ กักกัน หรือลบ
- ทุกแพตเว็บต้องแก้และทดสอบ repository root โดยตรง (`functions/`, `public/`, `scripts/`)
- `visiond-mvp/` เป็น snapshot เก่า ห้ามใช้เป็น deploy source และห้ามแก้แทน Active tree
- ไฟล์ใน `visiond-mvp/` ต้องผ่านการเทียบกับ Active tree ก่อนกักกันหรือลบ
- การทำความสะอาดใช้รายชื่อไฟล์แบบเจาะจง ห้าม wildcard และต้องมีคำสั่งย้อนคืนเมื่อเป็นไฟล์ที่ไม่ยืนยันว่าซ้ำ
