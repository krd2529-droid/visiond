# Active patch: Align A–F grade explanations

- Event: PATCH_DELIVERED
- Outcome: อธิบายและคำนวณเกรด A–F ตามเกณฑ์รายเดือนและบทบาทสินค้าที่ผู้ใช้กำหนด
- Preserve: เข้าแผงจัดการสินค้าตรง; ไม่มีแถบ 1/2; + ช่องใหม่เปิด TikTok OAuth
- Acceptance: A ≥30/เดือน; B 16–29/เดือน; C 1–15/เดือน; D สินค้าทดสอบ; E กระแส/AI แนะนำ; F คัดออก; สูตรคำนวณและการเปลี่ยนสถานะตรงกันทั้ง client/API/AI
- Phase: deployed as ad9d2c7f; production assets 02109/02085 verified with monthly A/B/C and D test action
- Files: functions/_tiktok_analyzer.js, functions/api/admin/tiktok-analyzer/index.js, migrations/0080_tiktok_monthly_grade_semantics.sql, public/tiktok-analyzer.js, public/tiktok-analyzer.css, public/tiktok-analyzer.html, tests
