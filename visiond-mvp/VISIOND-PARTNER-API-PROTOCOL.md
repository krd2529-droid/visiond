# VisionD Partner API Protocol

## กฎถาวร

0. งานเว็บ 2 และเว็บคู่ค้าทุกระยะต้องเพิ่มและจัดการภายในปุ่ม `ศูนย์ควบคุมเว็บพาร์ทเนอร์` เพียงจุดเดียว ห้ามสร้างปุ่มควบคุมเว็บ 2 กระจัดกระจายในหลังบ้าน
1. เว็บ 2 และเว็บไซต์คู่ค้าต้องมีฐานสมาชิก ออเดอร์ และข้อมูลส่วนตัวของตัวเอง ห้ามเชื่อมฐานข้อมูล VisionD โดยตรง
2. การเชื่อมทุกฟังก์ชันใช้ Versioned API หรือ Signed Event เท่านั้น
3. Credential แยกต่อเว็บไซต์ เก็บ Secret แบบ AES-GCM และ Hash แสดงค่าจริงครั้งเดียว และเพิกถอนได้จาก VisionD
4. ใช้ Least Privilege Scope; ระยะที่ 1 อนุญาตเฉพาะ `products:read`
5. Product API ส่งเฉพาะ Metadata ของสินค้าที่เผยแพร่แล้ว ห้ามส่งไฟล์ดาวน์โหลด Token ข้อมูลธนาคาร หรือข้อมูลลูกค้า
6. ทุกคำขอมี Request ID และ Audit Log โดยไม่บันทึก Secret หรือ IP จริง
7. VisionD เป็น Control Center และมีสิทธิ์ Pause/Revoke เว็บไซต์ได้ทันที
8. ฟังก์ชันระยะถัดไปต้องเพิ่ม Scope/API Contract/Audit/Test ก่อนเปิดใช้ Production

## Phase 1 Contract

- Admin: `/partner-api.html`
- Registry API: `/api/admin/partner-websites`
- Credential rotation: `/api/admin/partner-websites/{id}/credential`
- Partner catalog: `GET /api/partner/v1/products`
- Authentication: `X-VisionD-Client-ID` และ `Authorization: Bearer <Client Secret>`
- Scope: `products:read`
