# Active patch: Restore sold-product shortlist action

- Status: PATCH_DELIVERED — v0.20.91/cache02150, exact14-file commit `e88f9b4a` pushed to `origin/main`; Cloudflare Production `6cbafcde-fba4-4018-9493-065c43c5d39e` Active. Direct/custom Analyzer HTML200 and served JS exact202,131 bytes/SHA `826D0D1D9D3999C1E356CD84F6E42EB7DF366AA3B585F9DCC0D31C026B5F2AF3`.
- Outcome: real sold-product rows with a usable product name/ID show `เพิ่มเข้าลิสต์คัดสินค้า` even when TikTok supplied no product URL.
- Preserve: explicit click only; sales-derived A/B/C grade; duplicate handling; selected-channel ownership; blank URL remains truthful; one `แสดงผล` complete acquisition; existing OAuth/Helper/Showcase/Marketplace/analysis behavior.
- Safety: an empty or unidentifiable product name remains `ข้อมูลไม่พร้อม`; never fabricate a link or add across channels.
- Likely files: `visiond-mvp/public/tiktok-analyzer.js`, focused render/action regression, version/cache manifests and directly affected release tests.
- Verification: deterministic RED→green actual render/click, owner/source/grade/duplicate/placeholder/no-passive-write; full elevated v91→72; manifest14/14; visible/predeploy/diff; Mark0 findings; exact production asset match. Broad patch gate separately hits the pre-existing mobile scanner's rejection of the intentional `visiond-profile://` Helper protocol; native Helper regression passes.
- Next action: user hard-refreshes production, clicks `แสดงผล`, and verifies each named sold row now offers `เพิ่มเข้าลิสต์คัดสินค้า`; no production shortlist mutation was performed during delivery.

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
