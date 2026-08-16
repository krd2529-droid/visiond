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
13. Signed Webhook ต้องใช้ HMAC-SHA256 ครอบคลุม `timestamp.raw_body`, ตรวจแบบ constant-time และยอมรับ Timestamp คลาดเคลื่อนไม่เกิน 5 นาที
14. Signature Hash และ Idempotency Key ต้อง Unique ต่อเว็บไซต์; Payload ใน Retry Queue ต้องเข้ารหัส และ Log ห้ามมี Raw Body, Secret, Token หรือข้อมูลส่วนตัว
15. Retry ใช้ exponential backoff และย้าย Dead Letter เมื่อครบ 5 ครั้ง; การลองใหม่ต้องผ่านตัวประมวลผลและกฎข้อมูลเดียวกับ API ระยะ 2
16. ทุกเว็บไซต์ต้องมี Health Dashboard ช่วง 24 ชั่วโมง แสดง Success/Retry/Dead/Error Rate/Response Time/Event ล่าสุด โดย Metrics ห้ามมี Payload หรือข้อมูลส่วนตัว
17. Alert ขั้นต่ำ: Signature ผิด ≥1, Timestamp เกินกำหนด ≥1, Retry ค้าง ≥3 หรือ Dead Letter ≥1; Security Log เก็บเฉพาะรหัสเหตุการณ์ที่ปิดบัง
18. ก่อนเชื่อมเว็บ 2 ต้องผ่าน E2E Readiness ใน Sandbox ครบสินค้า ลูกค้า ออเดอร์ ชำระเงิน ยกเลิก คืนเงิน Idempotency Webhook Retry/Dead และ Alert โดยไม่เขียนข้อมูลทดสอบลง Production

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

## Phase 4 Signed Webhook Contract

- Endpoint: `POST /api/partner/v1/webhooks/events`
- Headers: `X-VisionD-Client-ID`, `X-VisionD-Timestamp`, `X-VisionD-Signature`, `Idempotency-Key`
- Signature: `v1=HMAC_SHA256(client_secret, timestamp + "." + raw_body)`
- Event envelope: `type`, `external_id`, `data`; types ได้แก่ `customer`, `order`, `payment`, `cancellation`, `refund`
- Queue control: `GET|POST /api/admin/partner-websites/{id}/webhooks` ภายในศูนย์ควบคุมเว็บพาร์ทเนอร์เท่านั้น

## Phase 5 Health Contract

- Health window: 24 ชั่วโมง แยกตาม Website ID
- Metrics: total, completed, retry, dead, error rate, average/max duration milliseconds, latest event
- Alerts: `SIGNATURE_FAILURE`, `TIMESTAMP_EXPIRED`, `RETRY_ACCUMULATED`, `DEAD_LETTER_PRESENT`
- Dashboard ใช้ Admin Webhook API เดิมและห้ามส่ง Payload Ciphertext, Signature, Secret, Token หรือข้อมูลลูกค้ากลับ Frontend

## Phase 6 E2E Readiness Contract

- Admin E2E: `POST /api/admin/partner-websites/{id}/e2e`
- เริ่มจากสินค้า Read-only แล้วจำลองลูกค้า ออเดอร์ ชำระเงิน ยกเลิก และคืนเงินใน Sandbox
- ตรวจ External ID, Idempotent Replay/Conflict, HMAC/Timestamp, Retry/Dead Letter และ Health Alert ในรอบเดียว
- ห้ามเขียนลูกค้าและออเดอร์ทดสอบลง Production และห้ามส่ง Client Secret, Signature หรือข้อมูลส่วนตัวกลับ Frontend
- เว็บไซต์ต้อง active และมี Scope `products:read`, `customers:write`, `orders:write` ครบ
