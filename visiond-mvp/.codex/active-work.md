# Active patch: Connected Marketplace search guard

- Event: PATCH_READY
- Outcome: ช่องที่เชื่อม TikTok Shop แล้วต้องค้นหาชื่อร้านและสินค้านางฟ้าได้ โดยไม่แจ้งผิดว่ายังไม่เชื่อม
- Preserve: หนึ่งการ์ดต่อหนึ่งช่อง; ทุกคำขอใช้ connection ของช่องที่เลือกเท่านั้น; ช่องที่ไม่ได้เชื่อมยังต้องถูกบล็อก
- Acceptance: ปุ่มค้นหารอสถานะ connection ของช่องที่เลือก; โหลดซ้ำก่อนตัดสินว่าไม่เชื่อม; ไม่ใช้ connection เก่าจากช่องอื่น; ทั้งการค้นหาร้านและค้นหาสินค้าใช้กติกาเดียวกัน
- Phase: implementation complete, verification passed
- Likely files: public/tiktok-analyzer.js, public/tiktok-analyzer.html, scripts/test-tiktok-marketplace-connection-guard.mjs
- Verification: JS syntax PASS; selected-channel connection guard PASS; separated shop/product search PASS; one-card-one-channel binding and isolation PASS; Showcase readiness PASS
