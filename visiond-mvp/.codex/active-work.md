# Active patch: TikTok Shop hydration race

- Event: PATCH_STARTED
- Outcome: ช่องที่เชื่อม TikTok Shop แล้วต้องค้น Marketplace ได้ทันที แม้กดค้นหาระหว่าง initial hydration
- Preserve: หนึ่งบัญชีต่อหนึ่งการ์ดช่อง; ห้าม fallback ข้ามช่อง; OAuth callback channel binding; ระบบออเดอร์และการจัดเกรดเดิม
- Acceptance: รวมคำขอ connection ซ้ำต่อช่อง; stale UI render ยังคืน connection snapshot; Marketplace ยึด channel_id ที่ capture ก่อน await; browser bypass stale cache; ปุ่มค้นหาไม่ล็อกด้วย client-side scope และแจ้งเมื่อ API ปฏิเสธจริง; genuine unconnected channel ยังแสดง error
- Event: PATCH_DELIVERED
- Phase: committed and pushed to main; production serves asset 02090
- Verification: syntax, hydration race, Marketplace channel guard, multi-channel isolation, Shop binding, Marketplace search/adversarial tests passed; production asset version verified in a real browser
- Files: public/tiktok-analyzer.js, public/tiktok-analyzer.html, scripts/test-tiktok-marketplace-connection-guard.mjs, scripts/test-tiktok-shop-hydration-race.mjs
