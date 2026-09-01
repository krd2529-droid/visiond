# VisionD Partner API — คู่มือเชื่อมเว็บ 2

Base URL: `https://visiondonline.com/api/partner/v1`

## 1. เตรียมเว็บไซต์

1. สร้างเว็บไซต์ใน `ศูนย์ควบคุมเว็บพาร์ทเนอร์`
2. กำหนด HTTPS Domain และ Scope เท่าที่ใช้จริง
3. เก็บ Client ID/Client Secret ใน Secret Manager ของเว็บ 2; ห้ามใส่ใน Frontend, Git หรือ Log
4. เปิดสถานะ `active` แล้วกด `ทดสอบ E2E` ให้ผ่านทั้งหมด

## 2. Authentication

- `X-VisionD-Client-ID: <CLIENT_ID>`
- `Authorization: Bearer <CLIENT_SECRET>`
- งานเขียนเพิ่ม `Idempotency-Key: <UNIQUE_KEY_8_TO_100_CHARS>`
- ทุกคำขอควรมี `X-Request-ID`

## 3. Endpoints

- `GET /products` — Scope `products:read`
- `GET /products/{id}` — Scope `products:read`; คืน Metadata ของสินค้าที่เผยแพร่และไม่คืนไฟล์/Token
- `GET /products/changes?cursor=0&limit=250` — Scope `products:read`; ใช้สร้างและอัปเดต Catalog ในฐานข้อมูลของเว็บ 2
- `POST /customers/sync` — Scope `customers:write`
- `POST /orders/sync` — Scope `orders:write`; ใช้ส่งออเดอร์ ชำระเงิน ยกเลิก และคืนเงิน
- `POST /commerce/orders` — Scope `commerce:write`; สร้าง Checkout จาก product ID โดย VisionD คำนวณราคาเอง
- `GET /commerce/orders/{external_order_id}` — Scope `commerce:read`; อ่านสถานะออเดอร์ของเว็บไซต์นั้น

### Product Delivery Contract

`GET /products` และ `GET /products/{id}` คืน `delivery` สำหรับแสดงหัวข้อ “คุณจะได้รับ” บนเว็บ 2 โดย `method` เป็น `visiond_claim` เสมอในสัญญาปัจจุบัน ตัวอย่าง:

```json
{"delivery":{"method":"visiond_claim","content_type":"digital_download","package_type":"bundle","file_format":"ชุด PDF","file_count":3,"page_count":120,"total_size_bytes":15728640,"bundle_item_count":2,"access_note":"รับสิทธิ์และดาวน์โหลดผ่าน VisionD หลังยืนยันการชำระเงิน"}}
```

Product Detail ของชุดอาจมี `delivery.items` สูงสุด 30 รายการ โดยแต่ละรายการมีเฉพาะ `id`, `title`, `file_format`, `file_count`, `page_count` ค่า count/size เป็น metadata ปัจจุบันและอาจเป็น `0` เมื่อผู้ขายยังไม่ได้แนบไฟล์ เว็บ 2 ต้องไม่ตีความว่าเป็น URL ดาวน์โหลด

ห้าม API และเว็บ 2 คืนหรือบันทึก `object_key`, download token, permanent download URL หรือ Credential ใน HTML/Browser/Log หลังสถานะ `fulfilled` ลูกค้ารับสิทธิ์ผ่าน `claim_url` อายุจำกัดตาม Commerce Contract เดิม
- `POST /webhooks/events` — Signed Webhook ด้วย HMAC-SHA256

ตัวอย่างที่คัดลอกได้อยู่ใน `docs/examples/partner-api-web2.http` และใช้ placeholder เท่านั้น

Starter Kit สำหรับ Backend เว็บ 2 อยู่ที่ `integrations/web2/` พร้อม Client, `.env.example` และวิธีใช้งาน ห้ามนำ Client หรือ Credential ไปใส่ Frontend bundle

สินค้าใช้ cursor pagination ค่าเริ่มต้น 50 และสูงสุด 100 รายการต่อ request หาก `pagination.has_more=true` ให้ส่ง `pagination.next_cursor` ใน request ถัดไปจนเป็น `false`; Starter Kit รองรับ `for await (const page of visiond.productPages())` เพื่อไล่สินค้าเกิน 100 รายการโดยไม่โหลดก้อนใหญ่ครั้งเดียว

### Local Product Mirror สำหรับเว็บ 2

เว็บ 2 ไม่ควรเรียก VisionD ทุกครั้งที่ลูกค้าเปิดหน้าเว็บ ให้ Backend เว็บ 2 ทำดังนี้:

1. ครั้งแรกเรียก `/products/changes?cursor=0` ต่อเนื่องจน `has_more=false`
2. เมื่อ `action=upsert` ให้ insert/update สินค้าในฐานข้อมูลเว็บ 2 และคัดลอกเฉพาะ `assets` (รูปปก/รูปตัวอย่างสาธารณะ) ไป R2 ของเว็บ 2 ได้
3. เมื่อ `action=delete` ให้เอาสินค้าออกจาก Catalog และลบรูปสาธารณะที่ mirror ไว้ แต่ห้ามลบประวัติคำสั่งซื้อหรือสิทธิ์ที่ลูกค้าจ่ายแล้ว
4. บันทึก `pagination.next_cursor` ใน transaction เดียวกับข้อมูลสินค้า หลัง transaction สำเร็จเท่านั้น
5. เรียกซ้ำจาก cursor ล่าสุดทุก 5 นาที หรือเมื่อผู้ดูแลสั่ง Sync; รอบที่ไม่มีการเปลี่ยนแปลงจะคืนรายการว่าง

Starter Kit รองรับ `for await (const page of visiond.productChangePages({cursor:lastCursor}))` โดย cursor เป็นเลขเพิ่มต่อเนื่องและครอบคลุมการสร้าง แก้ไข เผยแพร่ ซ่อน soft-delete และ physical-delete

ฟิลด์ `assets[].source_url` มีไว้ mirror เฉพาะภาพสาธารณะ ไม่ใช่ไฟล์สินค้าต้นฉบับ ระบบจะไม่คืน R2 object key, download token หรือ permanent download URL ผ่าน endpoint นี้

## 4. Signed Webhook

คำนวณ `v1=HMAC_SHA256(client_secret, timestamp + "." + raw_body)` และส่ง Header:

- `X-VisionD-Client-ID`
- `X-VisionD-Timestamp` เป็น Unix seconds และคลาดเคลื่อนไม่เกิน 5 นาที
- `X-VisionD-Signature`
- `Idempotency-Key`

## 5. ข้อมูลต้องห้าม

ห้ามส่ง Password/Passcode, Access/Refresh Token, API Key/Client Secret, Authorization ที่ฝังใน Payload, เลขบัตร/CVV/วันหมดอายุ และข้อมูลบัญชีหรือเส้นทางธนาคาร

## 6. Checklist ก่อนใช้งานจริง

- [ ] Domain เป็น HTTPS และเว็บไซต์ active
- [ ] Scope น้อยที่สุดและครบตามฟังก์ชัน
- [ ] Credential อยู่ใน Secret Manager และหมุนใหม่ได้
- [ ] E2E Readiness ผ่านทุกขั้น
- [ ] Idempotent Replay คืนผลเดิม และข้อมูลต่างกันตอบ 409
- [ ] Webhook HMAC/Timestamp ผ่าน; Payload Retry เข้ารหัส
- [ ] Retry/Dead Letter และ Health Alert ใช้งานได้
- [ ] Log ปิดบัง Credential, Signature, External ID และข้อมูลส่วนตัว
- [ ] รัน `npm run security:partner-api` ผ่าน
- [ ] เริ่ม Production ด้วยปริมาณต่ำและติดตาม Dashboard 24 ชั่วโมงแรก

## Rollback

Pause เว็บไซต์จาก VisionD ก่อน จากนั้นหยุดส่ง Event ที่เว็บ 2 โดยไม่ลบ External ID หรือ Idempotency record เพื่อรักษาความถูกต้องของข้อมูลเดิม

ก่อน Deploy ให้รัน `npm run test:partner-commerce-e2e`, `npm run test:partner-commerce-query-budget` และ `npm run security:partner-api` ทั้งสามคำสั่งต้องผ่าน

## 7. ขอบเขตการขายสินค้าดิจิทัล

API ที่เปิดใช้อยู่ในปัจจุบันรองรับการอ่าน Catalog และ sync ข้อมูลลูกค้า/ยอดขาย แต่ `POST /orders/sync` ไม่ใช่ Checkout และไม่ออกสิทธิ์ดาวน์โหลดให้ลูกค้า

Contract สำหรับ Digital Product Commerce ถูกล็อกไว้สำหรับ implementation ระยะถัดไปดังนี้:

`GET /products/{id}` เปิดใช้งานแล้วใน v0.14.408 สำหรับอ่านรายละเอียดสินค้า Metadata โดยไม่คืนไฟล์หรือ Token; หากสินค้าไม่เผยแพร่ ถูกลบ เป็น resale-rights หรือไม่มีอยู่ จะตอบ `PRODUCT_NOT_FOUND`

`POST /commerce/orders` เปิดใช้งานแล้วใน v0.14.409 ให้ Backend ของ Web 2 สร้างออเดอร์ด้วย External ID และ Idempotency Key โดย VisionD คำนวณราคาจริงเอง สถานะเริ่มต้นเป็น `pending_payment` เท่านั้น

`GET /commerce/orders/{external_order_id}` เปิดใช้งานแล้วใน v0.14.409 และตรวจสถานะออเดอร์ของเว็บไซต์นั้นเท่านั้น

หลัง native VisionD order ตรวจชำระและออก entitlement สำเร็จ Boss เชื่อมรายการจาก `Commerce Checkout` ในศูนย์ควบคุมเว็บพาร์ทเนอร์ ระบบตรวจยอด สินค้า จำนวน ราคา และ entitlement ให้ตรงกันก่อนเปลี่ยนเป็น `fulfilled`

เมื่อ Web 2 อ่านสถานะ fulfilled จะได้รับ `claim_url` อายุ 24 ชั่วโมงเพียงชั่วคราว ลูกค้าต้องเปิดลิงก์และเข้าสู่ระบบด้วยบัญชีเจ้าของ native order จากนั้นกดรับครั้งเดียว ไฟล์จริง, object key และ permanent download URL จะไม่ออกผ่าน Partner API

สถานะปกติคือ `created -> pending_payment -> pending_review -> paid -> fulfilled` โดย Web 2 ไม่มีสิทธิ์สั่งให้ออเดอร์เป็น `paid` หรือ `fulfilled` เอง

ค่าบริการ API 1 บาทเป็นต้นทุนภายในและไม่หักจากลูกค้า ไม่ต้องส่งเป็น line item, fee หรือยอดหักใน payload ของ Web 2

หมายเหตุ: Web 2 ยังไม่มีสิทธิ์อนุมัติ payment หรือ entitlement เอง; `pending_payment` ไม่ใช่หลักฐานชำระ และ claim จะเกิดได้ต่อเมื่อ native order เป็น `paid` พร้อม entitlement ครบเท่านั้น
