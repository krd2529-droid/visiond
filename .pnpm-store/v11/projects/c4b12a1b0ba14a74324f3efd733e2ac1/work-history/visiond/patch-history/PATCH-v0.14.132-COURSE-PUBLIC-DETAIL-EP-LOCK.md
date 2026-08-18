# PATCH v0.14.132 — Course Public Detail + EP Lock

- Route ผู้ขายคอร์ส: `/course-center` เท่านั้น; นำหน้า HTML เส้นทางเก่าออก
- หน้า `/course.html?id=...` แสดงชื่อ ปก ผู้สอน รายละเอียด ราคา และจำนวน EP จาก public aggregate API
- ไม่ดึงชื่อ/รายละเอียด/วิดีโอ/ไฟล์ EP ก่อนมีสิทธิ์; API รายละเอียด EP ยังคง `requireCourseAccess`
- Cart เก็บทั้ง Product ID และ Course ID เพื่อเปิดรายละเอียดคอร์สถูกตัวหลัง refresh ราคา
- ผู้มีสิทธิ์เห็น progress และเข้า V-Learning; ผู้ไม่มีสิทธิ์เห็นข้อความล็อกและปุ่มใส่ตะกร้า
- หน้าแก้ไขตะกร้ารวม EP และปุ่มส่งเผยแพร่ในหน้าเดียว
