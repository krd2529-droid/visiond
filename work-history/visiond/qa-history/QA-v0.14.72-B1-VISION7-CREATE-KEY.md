# QA v0.14.72 — B1 Vision 7 Create Program and Key

ตรวจเส้นทาง Admin → เพิ่มโปรแกรม V Easy → เลือกบัญชี → ออกคีย์ → ตั้งสถานะรอผูกร้าน รวมทั้งรหัสซ้ำ Product ID ผิด Secret ไม่พร้อม และ rollback เมื่อเกิดข้อผิดพลาด

ตรวจสัญญาร่วม APK → `/veasy/login` → `/api/vision7/auth/login` → `/api/vision7/activate` พร้อม Bearer token และ Device ID
