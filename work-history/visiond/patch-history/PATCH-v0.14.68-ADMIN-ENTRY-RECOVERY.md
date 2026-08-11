# PATCH v0.14.68 — Vision 7 Admin Entry Recovery

## งานหลุดที่ตรวจพบ

Requirement ระบุว่าต้องมีทางเข้าศูนย์ออกคีย์จาก Admin หลัก แต่ไฟล์ส่งมอบถึง v0.14.67 ไม่มีลิงก์ `/vision7-admin.html` ในหน้า Admin ขณะที่ Ledger ถูกติ๊ก `DONE-VERIFIED` ผิด เพราะเทสต์ตรวจเพียงว่าหน้าปลายทางมีอยู่

## การแก้ไข

- เพิ่มปุ่ม `🔑 Vision 7 · ออกคีย์` เข้า `.admin-tabs` เมื่อส่งหน้า `/admin` หรือ `/admin.html`
- ปุ่มเป็นลิงก์จริงไป `/vision7-admin.html`
- ใช้รูปแบบ `.admin-tab-link` เดิม จึงรองรับ Desktop และ Mobile ตาม CSS หลังบ้านปัจจุบัน
- เทสต์ใหม่ตรวจตัวทางเข้า, selector ที่ฉีดปุ่ม, เส้นทาง Admin และหน้าปลายทาง
- เอาหลักฐานอ่อน `public/admin.html` และ `test-v01463` ออกจาก Requirement ปัจจุบัน
- บันทึก `reopened_reason` เพื่อไม่ปกปิดว่ารายการนี้เคยถูกติ๊กเสร็จผิด

**EVENT CASE: เสร็จทั้งหมดแล้ว — พร้อมรับ Event Case ใหม่**
