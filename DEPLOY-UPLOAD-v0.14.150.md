# วิธีอัปแพต v0.14.150

แพตนี้เป็น Delta ต่อจากเว็บ v0.14.148 และรวมงาน v0.14.149 ที่ GitHub รับเข้า Commit ไม่ครบแล้ว

1. แตก ZIP บนคอมพิวเตอร์
2. เข้า Repository สาขา `main` แล้วเลือก `Add file` → `Upload files`
3. ลากไฟล์และโฟลเดอร์ทั้งหมดภายในโฟลเดอร์ที่แตกแล้ว ห้ามลากตัว ZIP
4. ก่อน Commit ต้องเห็นอย่างน้อย `VERSION.txt`, `public/index.html`, `public/admin.html`, `public/course-center.html` และ `public/course-seller.js` ในรายการเปลี่ยนแปลง
5. Commit ชื่อ `v0.14.150 deploy-safe course center repair`
6. หลัง Cloudflare สำเร็จ เปิดลิงก์ Pages เฉพาะ Deployment และยืนยันว่าป้ายเป็น `WEB v0.14.150`

ไฟล์ Delta มีจำนวนน้อยกว่า 100 ไฟล์ เพื่อไม่ชนข้อจำกัด GitHub Web uploader
