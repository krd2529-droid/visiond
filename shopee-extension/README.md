# VisionD Shopee Product Fill

Manifest V3 extension สำหรับนำเข้า JSON `visiond.shopee-product-handoff` version 1 จาก Toys Center แล้วช่วยกรอกหน้าสร้างสินค้า Shopee ทีละหน้าตามคำสั่งผู้ใช้

## ขอบเขตความปลอดภัย

- Extension ไม่รับรหัสผ่าน, cookie, session, token หรือข้อมูลบัญชี Shopee
- รับเฉพาะ JSON v1 ที่ข้อมูลครบและมีเฉพาะ allowlisted fields; unknown/private/prototype-sensitive fields ถูกปฏิเสธ และเก็บ payload เฉพาะ `chrome.storage.session`
- ดาวน์โหลดรูปจาก `https://visiondonline.com/api/toys-center/gallery/...` เท่านั้น โดยไม่ส่ง credential, จำกัดเวลา 10 วินาทีและขนาด 5 MiB ต่อรูป และตรวจ MIME ก่อนสร้าง `File`
- ไม่กด `ขั้นตอนต่อไป`, `บันทึก`, `ยืนยัน` หรือ `เผยแพร่` ผู้ใช้ต้องตรวจและกดเอง
- ทุก selector ต้องให้ผลเอกลักษณ์ มิฉะนั้นรายงาน `selector_drift` โดยไม่เดาช่อง
- Shopee ปัจจุบันแสดง `เพิ่มรูปภาพ (0/9)`. หาก JSON มี 10 รูป Extension จะหยุดด้วย `image_capacity` และไม่ตัด/สลับรูปเอง
- หน้า 1 รายงานเพียงว่าเลือกไฟล์แล้วและตัวนับ Shopee แสดงครบ (`counter_observed`) ไม่อ้างว่าเซิร์ฟเวอร์ Shopee อัปโหลดสำเร็จ ผู้ใช้ต้องตรวจสถานะอัปโหลดเอง
- SKU ไม่ถูกเขียนลงช่อง GTIN: จะกรอก SKU เฉพาะเมื่อพบ Seller SKU ที่แยกและระบุด้วย semantic label ได้เท่านั้น

## หลักฐาน selector

Runtime config อยู่ที่ `src/selector-config.js` และอ้างอิง `.agents/reports/jarvis-shopee-extension-dom-evidence-20260916.md`:

- หน้า 1: square-gallery file input `name=file`, `multiple`, `accept=image/*`, `aspect=1`; title container `data-product-edit-field-unique-id=name`; GTIN placeholder ที่ยืนยันแล้ว
- ตัด Shopee Standard Product search text/file inputs ออก
- หน้า 2: ใช้ visible Thai labels จากขอบเขตที่ผู้ใช้ยืนยัน ต้องอ่านกลับ breadcrumb หมวดหมู่เต็ม และ fail closed เมื่อหาเป้าหมายที่เอกลักษณ์ไม่ได้ (ยังไม่ได้พิสูจน์กับ DOM หน้า 2 จริง)
- ห้ามใช้ screen coordinates, generated `data-v-*` หรือ hashed CSS class เป็น selector หลัก

## ใช้งานแบบ Load unpacked

1. รัน `npm test` ในโฟลเดอร์นี้
2. เปิด `chrome://extensions`, เปิด Developer mode แล้วเลือก **Load unpacked**
3. เลือกโฟลเดอร์ `shopee-extension/` นี้ (ไม่เลือก `dist/`)
4. ดาวน์โหลด JSON จาก Toys Center, เปิด popup, เลือกไฟล์และตรวจ preview
5. เปิดหน้า `https://seller.shopee.co.th/portal/product/new?pageEntry=product_list`
6. กด **กรอกหน้าที่เปิดอยู่** ในแต่ละหน้า แล้วตรวจข้อมูลก่อนกดปุ่มของ Shopee เอง

การติดตั้ง Extension เป็นการกระทำบน browser ของผู้ใช้และต้องได้รับการยืนยัน ณ เวลาติดตั้ง งาน build/test ไม่ติดตั้งให้อัตโนมัติ

## ทดสอบและแพ็ก

```powershell
npm test
npm run package
```

ไฟล์ ZIP ที่ reproducible จะอยู่ใน `release/`. โฟลเดอร์นี้อยู่ระดับ repository root จึงไม่อยู่ใน Cloudflare Pages deploy root `visiond-mvp/public` และไม่ต้อง deploy เว็บไซต์หรือ migrate D1.
