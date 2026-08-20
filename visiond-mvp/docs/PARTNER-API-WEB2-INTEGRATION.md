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
- `POST /customers/sync` — Scope `customers:write`
- `POST /orders/sync` — Scope `orders:write`; ใช้ส่งออเดอร์ ชำระเงิน ยกเลิก และคืนเงิน
- `POST /webhooks/events` — Signed Webhook ด้วย HMAC-SHA256

ตัวอย่างที่คัดลอกได้อยู่ใน `docs/examples/partner-api-web2.http` และใช้ placeholder เท่านั้น

Starter Kit สำหรับ Backend เว็บ 2 อยู่ที่ `integrations/web2/` พร้อม Client, `.env.example` และวิธีใช้งาน ห้ามนำ Client หรือ Credential ไปใส่ Frontend bundle

สินค้าใช้ cursor pagination ค่าเริ่มต้น 50 และสูงสุด 100 รายการต่อ request หาก `pagination.has_more=true` ให้ส่ง `pagination.next_cursor` ใน request ถัดไปจนเป็น `false`; Starter Kit รองรับ `for await (const page of visiond.productPages())` เพื่อไล่สินค้าเกิน 100 รายการโดยไม่โหลดก้อนใหญ่ครั้งเดียว

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
