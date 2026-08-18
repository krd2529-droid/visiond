# VisionD v0.14.118 — B1 Slug + Key Slot Reset

- แก้ PATCH จาก APK `Origin: null` ที่เคยถูก global middleware บล็อกก่อนถึง Vision7 CORS.
- จำกัดสิทธิ์เฉพาะ Vision7 mobile API allowlist; origin อันตรายยังถูกปฏิเสธ.
- เพิ่มปุ่ม “ล้างสล็อตคีย์” ต่อคีย์ใน Vision7 Admin.
- ล้างเฉพาะอุปกรณ์ที่ active, App Session และ runtime leases; คงคีย์ ร้าน เจ้าของ อายุ ออเดอร์ และประวัติ.
- บันทึก Audit ผู้กด จำนวนสล็อต และเวลา.
- ตารางประวัติคีย์ไม่มี horizontal scrollbar; จอแคบแสดงเป็นการ์ด.
- Event Case รอ Redmi ยืนยัน Slug และล้างสล็อต 2/3 → 0/3 → เปิดใหม่ 1/3.
