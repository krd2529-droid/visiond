# Active patch: TikTok Showcase add API compatibility

- Event: PATCH_READY
- Outcome: เพิ่มสินค้าที่เลือกจาก Open Collaboration เข้า TikTok Showcase ผ่าน API ปัจจุบันได้ และแจ้งสิทธิ์ที่ขาดอย่างชัดเจน
- Acceptance: ใช้ POST /affiliate_creator/202405/showcases/products/add, ส่ง add_type PRODUCT_ID, แบ่งครั้งละไม่เกิน 20, ยอมรับ scope ที่เอกสารระบุ, ไม่มีสิทธิ์แล้วแนะนำเชื่อมใหม่โดยไม่ทำข้อมูลหลอก
- Phase: verified
- Likely files: functions/_tiktok_shop_api.js, functions/api/admin/tiktok-connections/index.js, public/tiktok-analyzer.js, tests, visible version
- Verification: official add endpoint/body and 20+5 batching executable PASS; creator.showcase.write and creator.video.write scopes PASS; marketplace regressions, visible version and predeploy PASS
- Delivery: pending
- Next: commit scoped files and push origin main
