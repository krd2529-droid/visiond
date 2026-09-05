# Active patch: Visible multi-channel selector

- Event: PATCH_READY
- Outcome: แสดงการ์ดหลายช่องในบล็อกช่องของฉัน และมีแถบเลือกช่องที่ชัดเจนในหน้าวิเคราะห์
- Acceptance: แถบสร้างจากช่องที่เชื่อมแล้ว; ระบุช่องที่กำลังดู; เลือกแล้วเปลี่ยนข้อมูลทั้งหน้า; รองรับหลายช่องและจอเล็ก; การ์ดเดิมยังกดได้
- Phase: delivery
- Likely files: public/tiktok-analyzer.js, public/tiktok-analyzer.css, tests
- Verification: JS syntax PASS; visible picker PASS; horizontal multi-card layout PASS; nine-queue contract PASS; one-card-one-channel isolation PASS
- Next: commit, push origin/main, and verify production asset
