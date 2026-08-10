# PATCH v0.14.73 — B1 Session and Shop Handoff

- ต่อหน้า Login ให้ผูกคีย์ V Easy กับร้านและ Facebook Page ID
- โหลด Account Scope และร้านของบัญชีหลังตรวจคีย์
- ส่งเฉพาะ Access Token, Device ID, Account Scope และร้านกลับ APK ผ่าน handoff ชั่วคราว
- ไม่ส่ง Password หรือคีย์ดิบกลับแอป
- Logout เพิกถอน Session ฝั่งเซิร์ฟเวอร์และล้าง handoff
