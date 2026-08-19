# PATCH v0.14.332 — Course edit video multipart

- แก้ข้อความหน้าแก้ไข EP จากวิดีโอสูงสุด 200 MB เป็น 2 GB
- แยกวิดีโอออกจาก FormData ของ API lessons และอัปโหลดผ่าน R2 Multipart
- คงไฟล์ประกอบสูงสุด 200 MB ต่อไฟล์ และไม่เปลี่ยน API contract/Database

`EVENT CASE: เสร็จแล้ว — หน้าแก้ไขตะกร้าคอร์สใช้วิดีโอ Multipart 2 GB แล้ว`

งานคิวเดิมที่พักไว้: Automated Patch Gate ยังห้ามเริ่มเองจนกว่า Boss จะสั่ง
