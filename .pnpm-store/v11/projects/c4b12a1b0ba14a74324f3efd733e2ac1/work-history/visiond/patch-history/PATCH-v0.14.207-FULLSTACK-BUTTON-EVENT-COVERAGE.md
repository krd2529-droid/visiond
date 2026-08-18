# PATCH v0.14.207 — Full-stack Button/Event Coverage

- ขยายกฎ Button/Event ให้ตรวจตั้งแต่ Frontend ถึง Backend และผลต่อข้อมูล
- ต้องทดสอบ allowed path และ denied/invalid path ที่สำคัญ
- UI-only ต้องระบุพร้อมหลักฐาน ไม่สร้าง Backend โดยไม่จำเป็น
- Rollback: `git revert SELF`; Boss เป็นผู้ Push/Deploy เท่านั้น
