# Active patch: selected-channel action switch

- Event: PATCH_READY
- Outcome: เพิ่มแอ็กชันสลับ “จัดการสินค้า” และ “ดูค่าคอม” ใต้ช่องที่เลือก
- Preserve: ช่องปัจจุบัน, ข้อมูลสินค้า, การเชื่อมบัญชี และข้อมูลค่าคอมเดิม
- Acceptance: จัดการสินค้าเป็นค่าเริ่มต้น; สลับโดยไม่ reload; ดูค่าคอมเฉพาะช่อง; responsive
- Phase: implementation complete; 14 focused/regression checks PASS; awaiting commit/push
- Files: TikTok analyzer JS/CSS/HTML and focused regression
