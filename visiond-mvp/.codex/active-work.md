# Active patch: TikTok shop-name product table

- Event: PATCH_READY
- Outcome: ผลค้นหาชื่อร้านแสดงตารางสินค้าจริงของร้านโดยไม่ปน snapshot หรือการเปรียบเทียบ 7 วัน
- Acceptance: แยกจากค้นหาสินค้านางฟ้า; แสดงรูป ชื่อสินค้า ร้าน ยอดขาย ราคา ค่าคอม หมวดหมู่ และเพิ่ม Showcase; ไม่แสดงความหนาแน่นครีเอเตอร์หรือเติบโต 7 วัน
- Phase: delivery
- Likely files: functions/api/admin/tiktok-connections/marketplace.js, public/tiktok-analyzer.js, tests
- Verification: syntax PASS; separated shop search PASS; supported columns PASS; adversarial Marketplace PASS; snapshot growth for angel search preserved PASS
- Next: commit, push origin/main, and verify production asset
