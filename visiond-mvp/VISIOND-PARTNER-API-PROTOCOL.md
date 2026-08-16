# VisionD Partner API Protocol

## กฎถาวร

0. งานเว็บ 2 และเว็บคู่ค้าทุกระยะต้องเพิ่มและจัดการภายในปุ่ม `ศูนย์ควบคุมเว็บพาร์ทเนอร์` เพียงจุดเดียว ห้ามสร้างปุ่มควบคุมเว็บ 2 กระจัดกระจายในหลังบ้าน
1. เว็บ 2 และเว็บไซต์คู่ค้าต้องมีฐานสมาชิก ออเดอร์ และข้อมูลส่วนตัวของตัวเอง ห้ามเชื่อมฐานข้อมูล VisionD โดยตรง
2. การเชื่อมทุกฟังก์ชันใช้ Versioned API หรือ Signed Event เท่านั้น
3. Credential แยกต่อเว็บไซต์ เก็บ Secret แบบ AES-GCM และ Hash แสดงค่าจริงครั้งเดียว และเพิกถอนได้จาก VisionD
4. ใช้ Least Privilege Scope; Catalog ใช้ `products:read`, ลูกค้าใช้ `customers:write`, ออเดอร์/ยอดขายใช้ `orders:write` แยกกัน
5. Product API ส่งเฉพาะ Metadata ของสินค้าที่เผยแพร่แล้ว ห้ามส่งไฟล์ดาวน์โหลด Token ข้อมูลธนาคาร หรือข้อมูลลูกค้า
6. ทุกคำขอมี Request ID และ Audit Log โดยไม่บันทึก Secret หรือ IP จริง
7. VisionD เป็น Control Center และมีสิทธิ์ Pause/Revoke เว็บไซต์ได้ทันที
8. ฟังก์ชันระยะถัดไปต้องเพิ่ม Scope/API Contract/Audit/Test ก่อนเปิดใช้ Production
9. API เขียนข้อมูลทุกคำขอต้องมี External ID และ Header `Idempotency-Key`; Key เดิมกับ Payload ต่างกันต้องตอบ Conflict และห้ามเขียนซ้ำ
10. ห้ามรับหรือเก็บ Password/Passcode, Access/Refresh Token เต็ม, API Key/Client Secret, เลขบัตร/CVV/วันหมดอายุ หรือบัญชี/เส้นทางธนาคารใน Payload ทุกระดับ
11. ข้อมูลระบุตัวลูกค้าต้องเข้ารหัส AES-GCM; จำนวนเงินใช้จำนวนเต็มหน่วยสตางค์ สกุล THB และตรวจยอดรายการ/ส่วนลด/คืนเงินก่อนเขียน
12. Sandbox ต้องแยกจากข้อมูล Production, ห้ามเขียนตารางลูกค้า/ออเดอร์จริง และประวัติต้องปิดบัง Credential, ข้อมูลส่วนตัว, External ID และ Idempotency Key

## Phase 1 Contract

- Admin: `/partner-api.html`
- Registry API: `/api/admin/partner-websites`
- Credential rotation: `/api/admin/partner-websites/{id}/credential`
- Partner catalog: `GET /api/partner/v1/products`
- Authentication: `X-VisionD-Client-ID` และ `Authorization: Bearer <Client Secret>`
- Scope: `products:read`

## Phase 2 Contract

- Customer sync: `POST /api/partner/v1/customers/sync` — Scope `customers:write`
- Order and sales sync: `POST /api/partner/v1/orders/sync` — Scope `orders:write`
- Required header: `Idempotency-Key` ความยาว 8–100 ตัวอักษร
- ใช้ `external_customer_id`, `external_order_id` และ `external_refund_id` ป้องกันทรัพยากรซ้ำต่อเว็บไซต์
- Admin data remains inside `/partner-api.html`; no separate backend control button is allowed.

## Phase 3 Sandbox Contract

- Admin Sandbox: `GET|POST /api/admin/partner-websites/{id}/sandbox`
- Scenarios: `customer`, `order`, `payment`, `cancellation`, `refund`
- ทดสอบ Scope, External ID, Idempotency Key และ Replay/Conflict โดยไม่เรียกหรือแก้ข้อมูล Production
- ประวัติแสดงเฉพาะค่าปิดบังและผลตรวจสอบ ห้ามแสดง Client Secret, Token เต็ม หรือข้อมูลส่วนตัว
