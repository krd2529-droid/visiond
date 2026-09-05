# Active patch: Refresh hydration for selected TikTok channel

- Event: PATCH_DELIVERED
- Outcome: รีเฟรชหน้าแล้วโหลดข้อมูลจัดการสินค้าของช่องที่เลือกล่าสุดอัตโนมัติ
- Preserve: การสลับช่อง การสลับหน้า 1/2 OAuth callback และ race guard เดิม
- Acceptance: จำช่องและแท็บล่าสุด; หากไม่มีค่าที่จำให้เลือกช่องที่เชื่อมแล้ว; hydrate Shop/Showcase/orders/selection list โดยไม่ต้องคลิกซ้ำ; ค่าเก่าที่ชี้ช่องถูกลบต้องไม่ทำให้หน้าค้าง
- Phase: committed, pushed to origin/main, production serves JavaScript v02097; authenticated refresh flow covered by regression tests
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.html, scripts/test-tiktok-refresh-hydration.mjs, scripts/test-tiktok-marketplace-selection-list.mjs
