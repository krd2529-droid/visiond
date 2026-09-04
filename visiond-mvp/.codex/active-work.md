# Active patch: TikTok Affiliate marketplace growth search

- Event: PATCH_DELIVERED
- Outcome: ค้นสินค้าจาก TikTok Shop Affiliate Open Collaboration marketplace ด้วยตัวกรองที่ผู้ใช้กำหนด โดยไม่จำกัดเฉพาะ Showcase
- Acceptance: ใช้ API ทางการและ scope ที่ถูกต้อง, ฟอร์มค้นแยกชัดเจน, เก็บ snapshot ยอดขายสะสมเพื่อคำนวณการเติบโตจริง, ครั้งแรกไม่สร้างค่าการเติบโตปลอม, เพิ่มสินค้าที่เลือกเข้า Showcase ได้, ระบบเดิมไม่ถอยหลัง
- Phase: complete
- Likely files: functions/_tiktok_shop_api.js, functions/_tiktok_analyzer.js, functions/api/admin/tiktok-marketplace-search.js, migrations, public/tiktok-analyzer.*, tests, visible version
- Verification: syntax PASS; marketplace helper/UI/adversarial PASS; legacy TikTok regressions PASS; visible version PASS; predeploy PASS (warnings are existing environment placeholders)
- Delivery: v0.20.28, commit 21d18375, pushed to origin main
- Next: production auto-deploy; TikTok Partner app must have creator.affiliate_collaboration.read before live marketplace search works
