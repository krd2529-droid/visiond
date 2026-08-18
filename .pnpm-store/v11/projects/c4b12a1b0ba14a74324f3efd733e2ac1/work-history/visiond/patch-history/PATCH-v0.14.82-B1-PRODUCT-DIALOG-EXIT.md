# VisionD v0.14.82 — B1 Product Dialog Exit Handoff

Event Case: B1-PRODUCT-DIALOG-001

## ขอบเขต

- เว็บ VisionD ยังคงใช้ API Login/Session/Shop ownership เดิม ไม่มีการเปลี่ยน Contract ที่ทำให้ V Easy 1.0.6 ใช้งานไม่ได้
- V Easy 1.0.6 แก้หน้าเพิ่มสินค้าให้ปิดด้วย X, แตะพื้นหลัง และ Android Back ได้โดยไม่ถูก required-field validation ขวาง
- หลังบันทึกสำเร็จจึงปิดหน้าต่างและแสดงสินค้าใหม่ทันที; หากผิดพลาดให้อยู่หน้าเดิมและแจ้งข้อผิดพลาด
- ล็อกปุ่มระหว่างบันทึกเพื่อกันการสร้างสินค้าซ้ำจากการกดเร็ว

## ชุดส่งมอบ บ1

1. `visiond-v0.14.82-b1-product-dialog-exit-handoff.zip`
2. `V-Easy-v1.0.6-product-dialog-exit-source.zip`
3. `V-Easy-v1.0.6-product-dialog-exit-debug.apk`

เว็บเป็นเจ้าของบัญชี คีย์ สิทธิ์ และ Session; แอปเป็นเจ้าของหน้าจอสินค้าและการนำทาง Android ตามกฎ บ1
