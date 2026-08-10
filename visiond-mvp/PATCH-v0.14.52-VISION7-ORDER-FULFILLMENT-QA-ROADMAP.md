# VisionD v0.14.52 — Vision 7 Order Fulfillment + Permanent QA Roadmap

วันที่: 2026-08-10

## ส่งมอบในแพตนี้

- เพิ่มกฎ QA ถาวรใน Event Roadmap: ทุกแพต Smoke Check, ทุก 3 แพต Integration, ทุก 6 แพต Full Regression และทุก 10 แพต Deep Security/Data Audit
- เพิ่มกฎเปิด Event Case ด่วนเมื่อเว็บล่ม, Login/มือถือเสีย, ปลดล็อกผิด, ข้อมูลข้ามบัญชี, Secret รั่ว หรือเส้นทางสำคัญถูกบล็อก
- เชื่อมสินค้าแต่ละแพ็กเกจ Vision 7 กับ Product ID ในร้าน
- เมื่อคำสั่งซื้อชำระเงิน ระบบออกคีย์แยกตาม `order_item` จึงรองรับซื้อหลายจำนวนเป็นหลายคีย์
- การต่ออายุเป็นคำสั่งชัดเจนด้วย `renew_license_id` และขยายวันจากวันหมดอายุเดิมหรือจากวันนี้ถ้าหมดอายุแล้ว
- ตาราง fulfillment ใช้ `order_item_id` เป็น Primary Key ป้องกันออกคีย์ซ้ำเมื่อคำขอถูก retry
- License Key เก็บทั้ง hash สำหรับตรวจสอบและ AES-GCM ciphertext สำหรับให้เจ้าของบัญชีกลับมาดูคีย์เต็ม
- หน้าโปรแกรมของฉันแสดงและคัดลอกคีย์เต็มได้เฉพาะเจ้าของบัญชีที่ล็อกอิน

## Production Secret ที่ต้องตั้งก่อนเปิดขาย Vision 7

ตั้ง Cloudflare Secret `VISION7_LICENSE_ENCRYPTION_KEY` เป็นค่าสุ่มอย่างน้อย 32 ตัวอักษร สำรองไว้ในระบบจัดการ Secret และห้ามเปลี่ยนหลังเริ่มออกคีย์ หากยังไม่ตั้ง ระบบจะไม่รับออเดอร์/ทดลอง/ออกคีย์ Vision 7 เพื่อป้องกันคีย์ที่กู้คืนไม่ได้

## งาน Event Case ที่เหลือ

1. Meta Messenger webhook production: signature, dedupe, 24-hour policy, encrypted token และ retry
2. ELON `PAGE_SALES` เชื่อมข้อมูลสินค้า ราคา และนโยบายที่ตรวจสอบแล้ว
3. ระบบดาวน์โหลดตัวติดตั้งและบังคับอัปเดต Vision 7
4. ฟอร์มผู้ดูแลฉบับเต็มสำหรับออกคีย์ ต่ออายุ ระงับ และดูประวัติ
5. Ads API production ingestion และคำแนะนำจากข้อมูลจริง

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
