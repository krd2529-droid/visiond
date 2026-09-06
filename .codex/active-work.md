# Active patch: Remove diagonal sweep from paired VX GIFs

- Status: PATCH_READY — diagonal sweep removed from every frame of both paired GIF generators; cache advanced to `014586`. Both outputs remain 1600x260, 24 frames at 90ms, loop forever; paired artwork, copy, prices and card highlighting preserved. Browser desktop/mobile test and diff check pass.
- Paired redesign: both 1600x260 banners now derive from `vx-paired-banner-master-v014585.png`, share the exact baskets, lighting, teal palette, 24-frame/90ms loop and synchronized moving sheen. The lower banner retains all four bundle discounts; the upper keeps accessible VX HTML pricing and feature copy.
- Visual QA: first frames confirm identical edge artwork and background color; browser desktop/mobile placement, equal rendered height, prices, links and automatic movement pass.
- Verified: old and VX GIF both 1600x260; VX regenerated at mean RGB 13/88/85 versus former 7/32/33, 24 frames looping at 90 ms; desktop rendered heights differ by <=2px, central frame target 980px, automatic highlights and mobile fit pass.
- Root cause: old GIF is 1600x260 (6.15:1, mean RGB 72/121/120); VX GIF is 1200x400 (3:1, mean RGB 7/32/33). The live frame also targets 1190px instead of the old artwork's roughly 980px center.
- Correction: regenerate VX at 1600x260 with brighter teal grading and align its frame/content width to the old GIF.
- Delivery: blog/VX UI revision 32175a9a and supplied-logo GIF revision 406e534e pushed to origin main. Production homepage, blog and 1.77 MB GIF return 200; v014583 reference, angel-product copy and removal of motion button verified live.
- GIF update: generated from the supplied VX logo reference with imagegen, then encoded as a 24-frame looping GIF (1.77 MB) with moving sheen/glints. Live HTML copy/prices remain selectable and accessible. Browser banner/blog tests still pass.
- Verified: VX browser animation changes highlight automatically after two seconds with no button; old-GIF visual treatment, placement, prices, links, “ค้นหาสินค้านางฟ้า”, and mobile fit pass. Blog storefront header/footer, hero, three live article links, VX CTA, desktop/mobile layout pass. Diff check clean.
- Added: match the existing teal promo GIF, animate automatically without a control, add “ค้นหาสินค้านางฟ้า”, and redesign `/blog` with the full storefront shell and editorial cards.
- Added: use the supplied VX logo as the identity reference for a real animated GIF background while keeping prices and links as accessible HTML.
- Verified: browser placement directly above original GIF, prices/links, desktop/mobile screenshots, pause/resume and reduced-motion. Diff check passed; 486cbfe5 pushed to origin main. Production homepage returns 200 with vx-home-banner.css?v=014581 and multi-channel commission copy.
- Outcome: animated VX feature/price banner immediately above existing homepage bundle GIF; preserve GIF, checkout and rights.
- Copy: multi-channel management, combined/per-channel commission dashboard, product search, A–F and Showcase. Prices 10/490, 20/980, 30/1290 THB for 30 days.
- Implementation: scoped HTML/CSS motion with pause and reduced-motion support, link to Vtools plans; desktop/mobile visual and placement/link tests, scoped commit/push and live check.

## Previous VX rights delivery

- Status: PATCH_DELIVERED
- Delivery: 9ad7d975 base and 9fbeb073 EasySlip addition pushed to origin main. Production /vtools returns 200 with v014580 and EasySlip text; /api/vtools returns all three exact 30-day prices/limits. No production payment made.
- EasySlip verification: mocked provider response exercised real upload handler and grant transaction; success, replay, amount/recipient mismatch, local duplicate, provider outage and missing key PASS. No real transfer or production slip submission.
- Added requirement: VX purchases must automatically verify slips through platform EasySlip, independently of the Vision3 manual-mode switch. Grant only after amount, recipient and duplicate checks pass; verification failures never grant access.
- Outcome: Vtools catalog and cart sell VX 30 days: 10 accounts / 490 THB; 20 / 980; 30 / 1290.
- Contract: server prices, activation on approval, idempotent grant, renewal queues after current rights, refund revokes, expiry and channel quota enforced by server. Preserve admin access and owner isolation.
- Phase: implementation, scoped commit/push and public production verification complete. No live purchase/payment approval for testing.
- Verified: real in-memory order creation/approval/replay, all prices, renewal/refund/expiry, quota/restore/downgrade, owner and admin isolation; browser desktop/mobile catalog and cart; partner commerce E2E; existing TikTok isolation, shortlist and grade tests; syntax and diff checks.
- Baseline limitation: whole-commerce suite fails mobile shell check on unchanged public/blog.html. Relevant commerce assertions pass. Details: visiond-mvp/docs/vtools-vx-access.md.

## Previous delivered patch

- Status: PATCH_DELIVERED
- Requested outcome: show a real product image in the Showcase table whenever TikTok supplied one through either Showcase or order product data.
- Root cause: the image fallback shipped in JavaScript, but the HTML retained the pre-patch asset URL `tiktok-analyzer.js?v=02081`, allowing browsers/CDN to keep serving stale code.
- Add: advance the analyzer JavaScript cache token to `02082` and update its regression contracts.
- Preserve: existing Showcase image priority, ordering, grades, metrics, pagination, delete actions, and one-card-one-channel isolation.
- Acceptance: the rendered page references `tiktok-analyzer.js?v=02082`; no `02081` analyzer contract remains; the image fallback regression still passes.
- Likely files: analyzer HTML and cache-token regression tests.
- Phase: implementation complete; delivery in progress.
- Verification: analyzer cache-busting PASS; Showcase order-image fallback PASS; sold-product name resolution PASS; F/ungraded PASS; manual C PASS; separated Marketplace/shop search PASS; Creator readiness PASS; diff check PASS.
- Delivery: cache-busting correction committed as `35d9a4ca` and pushed to `origin main`.
