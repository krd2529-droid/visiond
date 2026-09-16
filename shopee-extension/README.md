# VisionD Marketplace Product Fill

Manifest V3 extension สำหรับนำเข้า JSON `visiond.shopee-product-handoff` หรือ `visiond.thaimart-product-handoff` version 1 จาก Toys Center แล้วช่วยกรอกหน้าสร้างสินค้าของแพลตฟอร์มที่ตรงกันตามคำสั่งผู้ใช้

## ขอบเขตความปลอดภัย

- Extension ไม่รับรหัสผ่าน, cookie, session, token หรือข้อมูลบัญชี Marketplace
- รับเฉพาะ JSON v1 ที่ข้อมูลครบและมีเฉพาะ allowlisted fields; unknown/private/prototype-sensitive fields ถูกปฏิเสธ แยก schema/state ของ Shopee กับ Thai Mart และเก็บ payload เฉพาะ `chrome.storage.session`
- ดาวน์โหลดรูปจาก `https://visiondonline.com/api/toys-center/gallery/...` เท่านั้นโดยไม่ส่ง credential และตรวจ MIME กับ magic bytes ก่อนสร้าง `File`; Shopee จำกัด 5 MiB และ Thai Mart จำกัด 10 MiB ต่อรูป
- ไม่กด `ขั้นตอนต่อไป`, `บันทึก`, `ยกเลิก`, `ยืนยัน`, `นำเข้า` หรือ `เผยแพร่` ผู้ใช้ต้องตรวจและกดเอง
- ทุก selector ต้องให้ผลเอกลักษณ์ มิฉะนั้นรายงาน `selector_drift` โดยไม่เดาช่อง
- Shopee ปัจจุบันแสดง `เพิ่มรูปภาพ (0/9)`. หาก JSON มี 10 รูป Extension จะหยุดด้วย `image_capacity` และไม่ตัด/สลับรูปเอง
- หน้า 1 รายงานเพียงว่าเลือกไฟล์แล้วและตัวนับ Shopee แสดงครบ (`counter_observed`) ไม่อ้างว่าเซิร์ฟเวอร์ Shopee อัปโหลดสำเร็จ ผู้ใช้ต้องตรวจสถานะอัปโหลดเอง
- SKU ไม่ถูกเขียนลงช่อง GTIN: จะกรอก SKU เฉพาะเมื่อพบ Seller SKU ที่แยกและระบุด้วย semantic label ได้เท่านั้น
- Thai Mart รองรับเฉพาะ `https://seller.thaimart.com/products/create`; ใช้รูป JPG/PNG 1–9 รูป และแยก file input ใต้ `รูปสินค้า` ออกจาก image input ใน rich-text `รายละเอียดสินค้า`
- Thai Mart กรอกเฉพาะหมวดหมู่ที่ล็อกไว้ ชื่อ รายละเอียด SKU ราคา สต็อก น้ำหนัก และขนาด ไม่แตะ video, variants หรือ published status

## หลักฐาน selector

Runtime config อยู่ที่ `src/selector-config.js` และอ้างอิง `.agents/reports/jarvis-shopee-extension-dom-evidence-20260916.md`:

- หน้า 1: square-gallery file input `name=file`, `multiple`, `accept=image/*`, `aspect=1`; title container `data-product-edit-field-unique-id=name`; GTIN placeholder ที่ยืนยันแล้ว
- ตัด Shopee Standard Product search text/file inputs ออก
- หน้า 2: ใช้ visible Thai labels จากขอบเขตที่ผู้ใช้ยืนยัน ต้องอ่านกลับ breadcrumb หมวดหมู่เต็ม และ fail closed เมื่อหาเป้าหมายที่เอกลักษณ์ไม่ได้ (ยังไม่ได้พิสูจน์กับ DOM หน้า 2 จริง)
- ห้ามใช้ screen coordinates, generated `data-v-*` หรือ hashed CSS class เป็น selector หลัก

Thai Mart runtime config อยู่ที่ `src/thaimart-selector-config.js` และอ้างอิง `.agents/reports/jarvis-thaimart-live-form-evidence-20260916.md`. ทุก named control ต้องมี visible match เดียว; gallery/rich-text/category ต้อง resolve ภายใน section/dialog ที่ถูกต้อง และ breadcrumb หลังเลือกต้องตรงครบทั้งสามระดับ

## ใช้งานแบบ Load unpacked

1. รัน `npm test` ในโฟลเดอร์นี้
2. เปิด `chrome://extensions`, เปิด Developer mode แล้วเลือก **Load unpacked**
3. เลือกโฟลเดอร์ `shopee-extension/` นี้ (ไม่เลือก `dist/`)
4. ดาวน์โหลด JSON Shopee หรือ Thai Mart จาก Toys Center, เปิด popup, เลือกไฟล์และตรวจ preview
5. เปิดหน้า Shopee ที่กำหนด หรือ `https://seller.thaimart.com/products/create` ให้ตรงกับ JSON
6. กด **กรอกหน้าที่เปิดอยู่** แล้วตรวจข้อมูลก่อนกดปุ่มของ Marketplace เอง

การติดตั้ง Extension เป็นการกระทำบน browser ของผู้ใช้และต้องได้รับการยืนยัน ณ เวลาติดตั้ง งาน build/test ไม่ติดตั้งให้อัตโนมัติ

## ทดสอบและแพ็ก

```powershell
npm test
npm run package
```

ไฟล์ ZIP ที่ reproducible จะอยู่ใน `release/`. โฟลเดอร์นี้อยู่ระดับ repository root จึงไม่อยู่ใน Cloudflare Pages deploy root `visiond-mvp/public` และไม่ต้อง deploy เว็บไซต์หรือ migrate D1.
