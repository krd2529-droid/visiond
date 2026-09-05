# Active patch: TikTok Shop hydration and shop-search timeout

- Event: PATCH_STARTED
- Outcome: ช่องที่เชื่อมแล้วค้น Marketplace ได้ทันที และค้นชื่อร้านโดยส่งคำไป TikTok ตั้งแต่หน้าแรกโดยไม่จบเป็น gateway 502
- Preserve: หนึ่งบัญชีต่อหนึ่งการ์ดช่อง; ห้าม fallback ข้ามช่อง; OAuth callback channel binding; ระบบออเดอร์และการจัดเกรดเดิม
- Acceptance: รวมคำขอ connection ซ้ำต่อช่อง; stale UI render ยังคืน connection snapshot; Marketplace ยึด channel_id ที่ capture ก่อน await; browser bypass stale cache; ปุ่มค้นหาไม่ล็อกด้วย client-side scope และแจ้งเมื่อ API ปฏิเสธจริง; genuine unconnected channel ยังแสดง error
- Event: PATCH_CONTINUED_AFTER_PRODUCTION_502
- Phase: shop keyword forwarding, one-page boundary, and timeout mapping implemented; pending commit, push, and production verification of asset 02091
- Verification: syntax, hydration race, Marketplace channel guard, multi-channel isolation, Marketplace search/adversarial tests passed locally
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.html, scripts/test-tiktok-marketplace-connection-guard.mjs, scripts/test-tiktok-shop-hydration-race.mjs
