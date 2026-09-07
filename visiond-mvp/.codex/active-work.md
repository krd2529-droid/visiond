# Active patch: Commission share-card template

- Event: PATCH_READY
- Outcome: เตรียมเทมเพลตรูปค่าคอมสำหรับสร้างและแชร์เมื่อมีค่าคอมจริง
- Preserve: ปุ่มแสดงเฉพาะเมื่อมีค่าคอมจริง, การดาวน์โหลด/แชร์เดิม, ข้อมูลจาก TikTok และห้ามสร้างตัวเลขทดแทน
- Acceptance: ภาพ 1080x1350; ธีม VisionD/VX; ยอดรวมเด่น; แยกช่องสูงสุด 6; มีช่วงข้อมูล/ลิงก์/หมายเหตุ; รองรับแชร์และดาวน์โหลด; ปฏิเสธ model ที่ไม่มียอด
- Phase: canvas template พร้อม; focused + commission regression ผ่าน; ตรวจ fallback ของ browser compatibility แล้ว
- Blocker: ไม่มีสำหรับเทมเพลต; ข้อมูลจริงยังรอ collector adapter ตามงานก่อนหน้า
- Files: public/tiktok-commission-card.js, public/tiktok-analyzer.js, focused regression
- Next: commit/push และ production asset verify
