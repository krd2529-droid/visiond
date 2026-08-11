# VisionD v0.14.83 — B1 Live Product Sync

Event Case: B1-LIVE-PRODUCT-001

## ใช้งานได้ในแพตนี้

- VisionD เป็นเจ้าของฐานสินค้า V Easy จริงผ่าน `veasy_categories` และ `veasy_products`
- API รายการสินค้าและสร้างสินค้าตรวจ Bearer Session, Device ID, User ID และ Shop ID
- ร้านหนึ่งอ่านหรือสร้างสินค้าให้อีกร้านไม่ได้
- จำกัดจำนวนสินค้าตาม `plan_limit` ของร้าน (ค่าเริ่มต้น 20)
- SKU, Slug และ Idempotency Key ไม่ซ้ำภายในร้าน
- การส่งคำขอเดิมซ้ำจะคืนสินค้ารายการเดิม ไม่สร้างซ้ำ
- V Easy 1.0.7 โหลดสินค้าจาก VisionD และคงข้อมูลในฟอร์มเมื่อบันทึกล้มเหลว

## ชุดส่งมอบ

1. `visiond-v0.14.83-b1-live-product-sync.zip`
2. `V-Easy-v1.0.7-live-product-sync-source.zip`
3. `V-Easy-v1.0.7-live-product-sync-debug.apk`

งานรูปสินค้า แก้ไข ลบ QR และเผยแพร่หน้าร้านอัตโนมัติยังเป็นแพตถัดไป ไม่ถูกติ๊กเสร็จในรอบนี้
