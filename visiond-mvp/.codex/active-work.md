# Active patch: visible AI grade-E recommendations

- Event: PATCH_DELIVERED
- Outcome: แสดงตารางสินค้าแนะนำจาก AI เกรด E ใต้ทิศทางช่อง
- Preserve: ตารางสินค้านางฟ้า, สินค้าถัดไป, ลิสต์คัดสินค้า และตรรกะเกรดจากยอดขาย
- Acceptance: แสดงเฉพาะ E, รวมข้อมูลจาก AI candidates และ daily ranking, ไม่แสดงชื่อซ้ำ, รองรับมือถือ
- Phase: 12 focused/regression checks PASS; production verified
- Files: TikTok analyzer HTML/JS/CSS and focused regression
- Delivered: 3308b620 on origin/main; production uses JS v02117 and CSS v02087
