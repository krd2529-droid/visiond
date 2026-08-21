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
19. ก่อน Production ต้องมีคู่มือ ตัวอย่าง Placeholder, Checklist, Rollback และ Security Gate ที่ผ่าน โดย Credential ต้องอยู่ใน Secret Manager เท่านั้น
20. Starter Kit ใช้ได้เฉพาะ Backend เว็บ 2, Config ต้องเป็น HTTPS, Credential ต้องอยู่ใน Private State/Secret Manager และต้องปฏิเสธ Sensitive Payload ก่อนส่ง

## Phase 1 Contract

- Admin: `/partner-api.html`
- Registry API: `/api/admin/partner-websites`
- Credential rotation: `/api/admin/partner-websites/{id}/credential`
- Partner catalog: `GET /api/partner/v1/products`
- Authentication: `X-VisionD-Client-ID` และ `Authorization: Bearer <Client Secret>`
- Scope: `products:read`
- Pagination: `limit` ค่าเริ่มต้น 50 สูงสุด 100; cursor เป็น product ID จำนวนเต็มไม่ติดลบ; response คืน `has_more` และ `next_cursor`; Web 2 ต้องไล่หน้าจน `has_more=false`

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

## Phase 7 Integration Guide and Production Gate Contract

- คู่มือหลัก: `docs/PARTNER-API-WEB2-INTEGRATION.md`
- ตัวอย่าง HTTP: `docs/examples/partner-api-web2.http` ต้องใช้ Placeholder เท่านั้น
- Security Gate: `npm run security:partner-api`
- ห้ามเปิด Production ก่อน E2E ผ่าน, Credential อยู่ใน Secret Manager, Log ปิดบัง และมีแผน Pause/Rollback
- เริ่ม Production ด้วยปริมาณต่ำและติดตาม Health Dashboard อย่างน้อย 24 ชั่วโมงแรก

## Phase 8 Web 2 Starter Kit Contract

- Backend client: `integrations/web2/visiond-partner-client.mjs`
- Environment template: `integrations/web2/.env.example` ใช้ Placeholder เท่านั้น
- Client รองรับสินค้า ลูกค้า ออเดอร์ Signed Event, Request ID และ Idempotency Key
- ห้าม import Starter Kit เข้า Browser bundle และห้าม Log Config, Authorization Header, Signature หรือ Payload ส่วนตัว
- Starter Kit ต้องผ่าน `npm run security:partner-api` และ `npm run test:v014223`

## Phase 9 Digital Product Commerce Contract (Design Locked; Runtime Not Open)

- Phase นี้กำหนด contract ก่อน implementation; endpoint ใต้ `/commerce/*` ยังห้าม Web 2 เรียก Production จนกว่าแต่ละ endpoint จะมี migration, audit, focused test และ E2E ผ่าน
- Catalog เดิม `GET /products` เป็น metadata read-only และไล่เกิน 100 รายการด้วย cursor; `GET /products/{id}` เปิดใช้ใน v0.14.408 ด้วย Scope `products:read` และยังห้ามคืน `product_files.object_key`, download URL หรือ token
- Checkout `POST /commerce/orders` เปิด runtime ใน v0.14.409 พร้อม Scope `commerce:write`, `Idempotency-Key`, `external_order_id`, `external_customer_id` และรายการ `product_id`; VisionD คำนวณราคาจากฐานข้อมูลตัวเองและไม่รับยอดราคาจาก Web 2
- ตรวจสถานะ `GET /commerce/orders/{external_order_id}` เปิด runtime ใน v0.14.409 พร้อม Scope `commerce:read`; คืนเฉพาะ state, totals, entitlement readiness และ request ID โดย scope ด้วย Website ID ไม่คืนข้อมูลลูกค้ารายอื่น
- State machine: `created -> pending_payment -> pending_review -> paid -> fulfilled`; ทางออกคือ `cancelled|rejected|refunded`; ห้ามข้ามไป `paid|fulfilled` จากคำขอ Web 2 โดยตรง
- การ sync ที่ `POST /orders/sync` เป็นข้อมูลยอดขายภายนอกเพื่อ reconciliation เท่านั้น และต้องไม่สร้าง VisionD order, payment approval, entitlement หรือสิทธิ์ดาวน์โหลด
- การชำระและอนุมัติใช้ native VisionD order เดิมเป็น source of truth; Web 2 ห้ามส่งคำว่า paid เพื่อออกสิทธิ์เอง และค่าบริการ API 1 บาทไม่หักจากลูกค้าหรือเพิ่มในยอดชำระ
- v0.14.410 ให้ Boss เชื่อม Commerce Order กับ native order ที่ `paid` และมี entitlement จริง เมื่อยอด สินค้า จำนวน และ line total ตรงทั้งหมด; native order หนึ่งรายการใช้เชื่อมได้ครั้งเดียว
- การส่งมอบใช้ one-time claim อายุ 24 ชั่วโมง เก็บ token แบบ AES-GCM + hash, ส่งผ่าน URL fragment, บังคับ login เป็น native order owner และตรวจ entitlement ซ้ำก่อน consume; ห้ามส่งไฟล์ JPEG/PDF/ZIP, object key หรือ permanent download URL ผ่าน Partner API
- ทุก commerce read ต้อง scope ด้วย Website ID และ External ID; list endpoint ต้อง cursor pagination ค่าเริ่มต้น 50 สูงสุด 100 และมี query budget แบบ bounded ห้าม scan orders, items หรือ entitlements ทั้งตาราง
- Phase implementation แบ่งทีละแพต: product detail -> order create/status -> payment state handoff -> entitlement claim/download -> reconciliation/production E2E; ห้ามรวมเปิดขายครบวงจรในแพตเดียว
