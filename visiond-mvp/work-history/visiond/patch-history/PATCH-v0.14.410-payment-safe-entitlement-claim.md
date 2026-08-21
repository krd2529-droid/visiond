# PATCH v0.14.410 — Payment-safe Entitlement Claim

## Fulfillment Boundary

- Boss เชื่อม Commerce Order ได้เฉพาะ native VisionD order ที่ `paid`
- ยอดรวม สินค้า จำนวน line total และ entitlement ต้องตรงทุกบรรทัด
- Native Order หนึ่งรายการเชื่อมได้ครั้งเดียว
- Fulfillment ไม่เรียก `grantOrder` และไม่เขียน entitlement ใหม่

## One-time Claim

- token สุ่ม 256-bit โดยประมาณ เก็บ ciphertext AES-GCM และ SHA-256 hash
- Partner status คืน claim URL อายุ 24 ชั่วโมงผ่าน URL fragment
- Claim บังคับ VisionD session ของ native order owner
- ตรวจ active entitlement ซ้ำก่อน consume แบบ conditional write
- คืน product page และ entitlement metadata endpoint เท่านั้น ไม่คืน object key หรือ file endpoint

## UI

- Commerce queue อยู่ในศูนย์ควบคุมเว็บพาร์ทเนอร์
- action ใหม่ใช้ canonical `.vds-btn`
- async actions มี disabled/loading/success/error และ login return path

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
