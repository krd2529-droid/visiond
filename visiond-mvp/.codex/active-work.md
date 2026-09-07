# Active patch: Commission share-card template

- Event: PATCH_DELIVERED
- Outcome: เตรียมเทมเพลตรูปค่าคอมสำหรับสร้างและแชร์เมื่อมีค่าคอมจริง
- Preserve: ปุ่มแสดงเฉพาะเมื่อมีค่าคอมจริง, การดาวน์โหลด/แชร์เดิม, ข้อมูลจาก TikTok และห้ามสร้างตัวเลขทดแทน
- Acceptance: ภาพ 1080x1350; ธีม VisionD/VX; ยอดรวมเด่น; แยกช่องสูงสุด 6; มีช่วงข้อมูล/ลิงก์/หมายเหตุ; รองรับแชร์และดาวน์โหลด; ปฏิเสธ model ที่ไม่มียอด
- Phase: canvas template ส่งขึ้น production แล้ว; focused + commission regression ผ่าน; production asset และ browser-compatible rounded paths ผ่าน
- Blocker: ไม่มีสำหรับเทมเพลต; ข้อมูลจริงยังรอ collector adapter ตามงานก่อนหน้า
- Files: public/tiktok-commission-card.js, public/tiktok-analyzer.js, focused regression
- Delivered: d7167b2d on origin/main; production asset v02088 verified
- Next: เมื่อมีค่าคอมจริง ผู้ใช้กดสร้างรูปและแชร์จากหน้าค่าคอมได้ทันที
