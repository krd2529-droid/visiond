# PATCH v0.14.407 — Web 2 Digital Product Commerce Contract

## Contract Boundary

- Catalog ปัจจุบันยังเป็น metadata read-only พร้อม cursor pagination
- `/orders/sync` เป็น reconciliation เท่านั้นและห้ามออก entitlement
- Checkout runtime ในอนาคตต้องใช้ external ID, idempotency และราคา authoritative จาก VisionD
- Web 2 ห้ามสั่งสถานะ `paid` หรือ `fulfilled` เอง
- API 1 บาทไม่หักลูกค้าและไม่ปรากฏใน payload เป็น fee/line item
- หลังอนุมัติจึงออก entitlement และส่ง one-time claim handoff อายุสั้น; ไม่คืนไฟล์หรือ permanent download URL

## Query Budget

- list ค่าเริ่มต้น 50 สูงสุด 100 และใช้ cursor
- commerce read ต้อง scope ด้วย Website ID และ External ID
- ห้าม scan orders, items หรือ entitlements ทั้งตาราง

## Runtime Impact

- ไม่เพิ่มหรือแก้ endpoint runtime
- ไม่เปลี่ยนราคา การชำระ entitlement/download, Partner scopes หรือ UI behavior
- cache key/version stamp เป็น mechanical release metadata เท่านั้น ไม่มี CSS/JS behavior diff

## Verification

- `scripts/test-v014407.mjs`
- `scripts/partner-api-security-gate.mjs`
- current regression, visible-version และ predeploy

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
