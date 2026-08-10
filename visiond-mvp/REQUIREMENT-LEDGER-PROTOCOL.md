# Requirement Ledger — กฎกันงานหลุด

1. ทุกคำสั่งของ Boss ต้องมีรหัส Requirement แยก ห้ามรวมคำสั่งหลายเรื่องเป็นข้อกว้างจนตรวจไม่ได้
2. ก่อนแก้โค้ดต้องเพิ่มหรืออัปเดตรายการใน `requirements-ledger.json`
3. ก่อนส่งทุกแพตให้รัน `npm run requirements:check` และเทียบ `คำสั่ง → Requirement → ไฟล์หลักฐาน → ผลทดสอบ`
4. `DONE-VERIFIED` ต้องมีไฟล์หลักฐานที่มีอยู่จริง ส่วน `PENDING` และ `BLOCKED` ต้องคงอยู่ใน Ledger ห้ามหายจากคิว
5. `MISSING` และ `UNCERTAIN` ทำให้ Coverage Check ล้มเหลว ต้องแก้ก่อนส่งแพต
6. `REMOVED-BY-BOSS` ใช้เมื่อ Boss สั่งยกเลิกเท่านั้น พร้อมบันทึกเหตุผล ไม่ลบรายการทิ้ง
7. ก่อนประกาศ Event Case เสร็จ ต้องรัน `npm run requirements:close`; หากไม่ครบ ห้ามใช้สถานะเสร็จทั้งหมด
8. ทุก Integration/Regression audit ต้องย้อนตรวจ Ledger ข้ามแพต เพื่อจับงานที่ถูกติ๊กเสร็จผิดหรือหายจากคิว
