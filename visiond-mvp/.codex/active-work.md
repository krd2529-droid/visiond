# Active patch: selected-channel action switch

- Event: PATCH_DELIVERED
- Outcome: เพิ่มแอ็กชันสลับ “จัดการสินค้า” และ “ดูค่าคอม” ใต้ช่องที่เลือก
- Preserve: ช่องปัจจุบัน, ข้อมูลสินค้า, การเชื่อมบัญชี และข้อมูลค่าคอมเดิม
- Acceptance: จัดการสินค้าเป็นค่าเริ่มต้น; สลับโดยไม่ reload; ดูค่าคอมเฉพาะช่อง; responsive
- Phase: 14 focused/regression checks PASS; production verified
- Files: TikTok analyzer JS/CSS/HTML and focused regression
- Delivered: f9ba75c4 on origin/main; production uses JS v02118 and CSS v02088
