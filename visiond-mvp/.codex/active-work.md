# Active patch: TikTok feature heading hierarchy

- Event: PATCH_DELIVERED
- Outcome: หัวข้อทุกหน้าของฟีเจอร์ TikTok ต้องเห็นลำดับชั้นชัด อ่านกวาดตาแล้วแยกชื่อหน้า ชื่อส่วน และคำอธิบายได้ทันที
- Preserve: ข้อความเดิม โครงสร้างข้อมูล ปุ่ม และการทำงานทั้งหมด; รองรับเดสก์ท็อปและมือถือ
- Acceptance: หัวข้อระดับหน้ามีรูปแบบเดียวกัน; หัวข้อบล็อกสำคัญเด่นกว่าคำอธิบาย; ลิสต์คัดสินค้าในภาพเห็นเป็นหัวข้อชัด; สีและระยะห่างสอดคล้องทั้งสองแท็บ
- Phase: deployed
- Likely files: public/tiktok-analyzer.css, public/tiktok-analyzer.html, scripts/test-tiktok-heading-hierarchy.mjs
- Verification: heading hierarchy regression PASS; Showcase heading/toolbar PASS; horizontal channel selector PASS; cache version check PASS; existing marketplace-simplified-ui test remains stale because it expects the pre-channel-binding payload
- Delivery: commit 81b44b2d pushed to origin/main; stylesheet cache version advanced to 02077
- Next: reload both tabs and review the stronger page/section heading hierarchy
