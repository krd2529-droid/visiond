# PATCH v0.14.134 — Course Basket Interaction QA

QA-only patch:

- จำลอง API ตะกร้า/EP แล้วรัน JavaScript หน้าแก้ไขจริงใน VM
- ยืนยันชื่อคอร์สเดิมถูกเติม, ปุ่มแก้ไขเปิด editor และเติมข้อมูล EP เดิม
- ยืนยันบันทึกใช้ PUT lesson ID ที่เลือก และเผยแพร่ใช้ POST
- ปรับ test inventory ให้ใช้หน้า `course-center.html` แทน route ที่ถอดออก
