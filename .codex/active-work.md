# Active patch: VSMS imported sets visible on new phone

- Status: PATCH_READY (2026-10-19); signed APK verified, scoped commit/push pending.
- Outcome: new commercial-signed 0.5.11 APK makes a fresh phone visibly load imported caption/link sets, preserving all entries and existing non-empty drafts/queue; newly requested unequal counts pair in order and wrap shorter list.
- Acceptance and evidence: see `.agents/WORKBOARD.md` CURRENT PATCH. Local export contains 50 caption lines and 51 link URLs; do not falsely call it 50 links.
- Scope: Android import/new-queue pairing/UI/tests/version; no actual SMS transmission or website release.
- Verification: Android 136/136 and core 20,027 PASS; release build PASS; signed APK 0.5.11/code18 SHA-256 `1ABD37623734421D9EBBE39C457BCE4605CADC86E888CBA25630AADBB8D163DB`, one signer commercial cert unchanged. No live handset/SMS test. Scoped commit/push pending.
- Next action: Jarvis scoped commit/push and deliver local APK; no web release requested.

# Previous active patch: Remove channel-direction result card

- Status: PATCH_DELIVERED — v0.20.92/cache02151, exact18-file commit `ade55e48` pushed to `origin/main`; Cloudflare Production `ce8810cc-c6f0-41f4-ba18-f68ee3283c91` Active.
- Outcome: the visible `ทิศทางช่อง` result card and its dead client/CSS references are removed.
- Preserve: stored/generated channel_direction, strategy input/backend, summary, AI recommendations, shortlist, owner/race isolation, sold-product action and order/connection flows.
- Verification: actual saved/empty render with no direction node; full elevated v92→v72; manifest18/18; visible/predeploy/diff; Mark0 findings; direct/custom production HTML/JS/CSS token and asset checks.
- Next action: user hard-refreshes the Analyzer to see the card removed.

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
