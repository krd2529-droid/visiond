# PATCH v0.14.150 — Deploy-safe Course Center repair

- แก้ label ของสวิตช์ตรวจสลิปที่ปิด tag ไม่ครบ
- ย้ายออเดอร์รออนุมัติไปต่อจาก PART 6 และลบยอดขายรวมที่แสดงซ้ำ
- ทำเพดานรูปปกฝั่งสร้าง แก้ไข และ API ให้ตรงกันที่ 8 MB
- แก้ลิงก์แจ้งเตือนและ ELON ให้ใช้ `/course-center`
- ซ่อม Requirement evidence และเพิ่ม Patch Coverage Ledger
- ส่งแพตเป็น Delta ขนาดเล็กเพื่อไม่ชนข้อจำกัดการอัปโหลดไฟล์จำนวนมากผ่าน GitHub Web

## Deployment verification

หลัง Commit ต้องเห็น `VERSION.txt`, `public/index.html` และ `public/admin.html` ใน Files changed จากนั้นตรวจลิงก์ Pages เฉพาะ Deployment ว่าแสดง `WEB v0.14.150` ก่อนตรวจโดเมนหลัก
