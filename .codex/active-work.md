# Active patch: VSMS combined import populates visible editors

- Status: PATCH_DELIVERED (2026-10-19).
- Outcome: import one combined file → copy its caption and link lines into both visible editor fields immediately, persist draft, enable immediate queue creation without separate picker. Warn/confirm before replacing nonempty drafts; existing queue unchanged.
- Evidence/contract: `.agents/WORKBOARD.md` CURRENT PATCH. Exact fixture 50 captions/51 links; 0.5.11 hydrates only when fields empty.
- Scope: Android import/editor behavior, tests, 0.5.12/code19 signed APK; no web release or real SMS.
- Verification/delivery: red regression on 0.5.11; fixed exact-file path PASS; independent full Android 139/139; signed release build PASS. APK 0.5.12/code19 SHA-256 `243E6D7EA6EB57E848CC25ECDBADA2DA057D51530D585994036B7E976662FB6D` with unchanged commercial certificate. Fix commit `1f1065c1` pushed to `origin/main`; APK copied and hash-verified at `C:/Users/User/Downloads/VSMS-v0.5.12-release.apk`. No live handset or SMS test, no website APK update.
- Next action: user installs commercial 0.5.12 and chooses replace draft on combined import; report handset-specific outcome.

# Previous active patch: VSMS combined import available in Step 2/3 pickers

- Status: PATCH_BLOCKED (2026-10-19) on affected-handset evidence; no product-code failure reproduced.
- Outcome: after importing one combined captions+links file, both Step 2 caption-set and Step 3 link-set pickers offer those sets. No separate import files required.
- Evidence/contract: `.agents/WORKBOARD.md` CURRENT PATCH; user reports missing options on handset, but installed version and phone file are unverified. Exact local combined export has 50 captions and 51 links. Current 0.5.11 has both pickers in Step 2, Step 3 is SIM.
- Scope: diagnose exact import→library→picker flow; fix only if reproduced. Preserve drafts/queue/SMS and avoid web release.
- Verification/delivery: exact-file licensed Robolectric document-return import→preview→both pickers PASS; full Android 137/137 and Mark independent focused 1/1 PASS. No app-code change or new APK justified. Test-only commit/push pending.
- Next action: user supplies handset footer version and screenshot of preview/success or error after importing; then reproduce exact failed branch and patch if needed. No physical handset test or real SMS.

# Previous active patch: VSMS imported sets visible on new phone

- Status: PATCH_DELIVERED (2026-10-19).
- Outcome: new commercial-signed 0.5.11 APK makes a fresh phone visibly load imported caption/link sets, preserving all entries and existing non-empty drafts/queue; newly requested unequal counts pair in order and wrap shorter list.
- Acceptance and evidence: see `.agents/WORKBOARD.md` CURRENT PATCH. Local export contains 50 caption lines and 51 link URLs; do not falsely call it 50 links.
- Scope: Android import/new-queue pairing/UI/tests/version; no actual SMS transmission or website release.
- Verification: Android 136/136 and core 20,027 PASS; release build PASS; signed APK 0.5.11/code18 SHA-256 `1ABD37623734421D9EBBE39C457BCE4605CADC86E888CBA25630AADBB8D163DB`, one signer commercial cert unchanged. No live handset/SMS test.
- Delivery: source `630af32e` pushed to `origin/main`; verified APK copied to `C:/Users/User/Downloads/VSMS-v0.5.11-release.apk`. No web release requested.
- Next action: user installs local APK over commercial 0.5.10, imports saved sets, and reports any handset-specific issue.

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
