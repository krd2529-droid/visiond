# v0.14.116 — B1 Live Shop Profile

- เพิ่ม Slug ให้ร้าน V Easy ที่ผูกคีย์จริงแบบ additive migration
- เพิ่ม owner-scoped GET/PATCH `/api/vision7/shops/:shopId`
- ป้องกัน Slug ซ้ำและคืนข้อความผิดพลาดตรงสาเหตุ
- APK v1.0.15 ใช้ API ร้านจริงและอัปเดต Session หลังบันทึก
- Deploy Web ก่อนติดตั้ง APK; รอทดสอบ Redmi เพื่อปิด Event Case
