# Active patch: VSMS explicit single-SIM choice and delay

- Status: PATCH_READY (2026-10-20): focused independent 18/18 and full Android offline 159/159 PASS; commercial-signed 0.5.17/code24 APK built and hash-verified. Scoped commit/push remains.
- Outcome: in Step 3 explicitly choose one-SIM SIM 1 or SIM 2, and identify the existing one-SIM cadence (first immediate; success 10–30 minutes; failure 1 minute before next recipient). New queues retain chosen physical slot and stop before handoff if that SIM is moved/replaced; no automatic switch to the other SIM.
- Scope: Android selection/queue validation, focused tests/version 0.5.17/code24, commercial signed local APK. Preserve alternate mode, old queues, all send cadence, sender history, and license. No real SMS or website deployment.
- Next: Jarvis verify branch/remote, scoped commit and non-force push origin main, then verify remote head and deliver local APK. No website upload or real SMS.

# Previous active patch: VSMS clear draft editors and identify sender per SMS

- Status: PATCH_DELIVERED (2026-10-20): combined source focused 7/7 and full/independent offline 153/153 PASS, commercial-signed 0.5.16/code23 APK copied/hash-verified. Source commit `1de83d0e` pushed non-force to `origin/main`, remote head verified. No web upload, handset install, or real SMS.
- Outcome: separate clear buttons for Step 2 caption and short-link drafts; each actual SMS row shows chosen SIM plus best-effort sender number from permitted Android API or clearly labeled manual fallback. If unavailable, explicit unknown; never guess. Preserve saved sets, queue, optional original link, and send cadence.
- Scope: Android Step 2/3 UI, optional number permission/manual fallback, sender snapshot/history/CSV, focused tests/version 0.5.16/code23, signed local APK. No backend/web release or real SMS.
- Delivery: `C:/Users/User/Downloads/VSMS-v0.5.16-release.apk`, SHA-256 `54E914C28D1305A115D582FA38E26C8AC766D99741F477DF0AECAC42CE822B19`, commercial certificate unchanged. Final status-only commit/push next; physical handset sender-number accuracy unverified.

# Previous active patch: VSMS running/stopped status icon

- Status: PATCH_DELIVERED (2026-10-20): user specified green icon for running and red icon for stopped. Source commit `4563d0ee` pushed non-force to `origin/main`; signed local APK delivered. No web release or real SMS.
- Outcome: prominent icon and label in Android current-work section accurately reflect persisted `running` state on launch and each refresh, including waiting/error, while keeping existing detail and send behavior.
- Scope: MainActivity status presentation, focused UI tests, version 0.5.15/code22, commercial signed APK. No SMS send/backend/web release.
- Verification: focused UI 4/4 and full offline Android 145/145, Mark independent rerun PASS; release assemble/signature/version/hash PASS. APK `C:/Users/User/Downloads/VSMS-v0.5.15-release.apk` SHA-256 `18B46715D274BC13F0327B06B09D63B76CE43CE68FA13A0F74FC217BDB479EF2`, commercial signer unchanged. No live handset/SMS or website upload.
- Delivery: `C:/Users/User/Downloads/VSMS-v0.5.15-release.apk`, code22, SHA-256 `18B46715D274BC13F0327B06B09D63B76CE43CE68FA13A0F74FC217BDB479EF2`; commercial certificate unchanged. Final status-only commit/push next; physical handset rendering unverified.

# Previous active patch: VSMS move to next recipient one minute after confirmed failed SMS

- Status: PATCH_DELIVERED (2026-10-20) — user corrected the earlier interpretation; no same-number retry. Source commit `55bbd14d` pushed non-force to `origin/main`; signed local APK delivered. No web release or real SMS.
- Outcome: confirmed failed sent callback marks current recipient FAILED, waits 60 seconds, then sends next unsent recipient; never sends failed number again. Existing success cadence and dual-SIM handoff otherwise preserved.
- Contract/evidence: `.agents/WORKBOARD.md` CURRENT PATCH. Scope Android failure cadence, directly related UI text/tests/version, signed local APK; no website publish or live SMS. Elon only code writer; Mark independent verification.
- Verification: old-source red 3/3, new-source focused and full offline Android 141/141, Mark independent rerun 141/141, release assemble/signature/version/hash PASS. APK `C:/Users/User/Downloads/VSMS-v0.5.14-release.apk` SHA-256 `D7EACE4AEA070DD6DA65703D744862FCFDD170004F6013C094C81F0196BFD922`, commercial signer unchanged. No live handset/SMS or website upload.
- Delivery: `C:/Users/User/Downloads/VSMS-v0.5.14-release.apk`, code21, SHA-256 `D7EACE4AEA070DD6DA65703D744862FCFDD170004F6013C094C81F0196BFD922`; signed with unchanged commercial cert. Final status-only commit/push is next; physical handset/cellular result remains unverified.

# Previous active patch: คลังเบอร์ VSMS แยกจากศูนย์คีย์

- Status: PATCH_DELIVERED (2026-10-19).
- Outcome: link/button `คลังเบอร์ VSMS` in `/admin.html` opens dedicated successful-SMS archive; remove buried key-center card, preserve boss-only data/API and pagination; show `ไม่แสดง` for current logged-in owner's name, without exposing that name in self-row API responses.
- Evidence/contract: `.agents/WORKBOARD.md` CURRENT PATCH. No SMS, license, Android, schema, or customer data mutation.
- Scope: main admin menu, dedicated archive HTML/CSS/JS, self-owner API masking, removal of old card/client, focused tests/cache token if needed.
- Verification: focused API/auth/self-mask/other-owner/index/paging PASS; desktop and 390px browser menu navigation, pagination, labels, empty/error, key-center removal PASS; independent Mark rerun PASS; JS syntax and diff check PASS. Production main admin/new archive/key center HTTP checks PASS; authenticated archive loaded real rows and showed `ไม่แสดง` for self owner without error.
- Delivery: commit `d05fb78b` pushed to `origin/main`; new page `https://visiondonline.com/vsms-successful-sends` live. No Android/SMS/data mutation.

# Previous active patch: VSMS import confirmation controls visible on Android

- Status: PATCH_DELIVERED (2026-10-19).
- Outcome: user photo shows valid 50/51 preview but no action control; replace `setMessage`+`setItems` import/secondary dialogs with visible buttons, then import fills both editor fields.
- Evidence/contract: `.agents/WORKBOARD.md` CURRENT PATCH; exact screenshot `C:/Users/User/Downloads/S__21569539.jpg`, exact combined JSON file. No real SMS or web upload.
- Scope: Android dialog controls/tests/version 0.5.13/code20; preserve drafts/queue/library and prior 0.5.12 editor hydration.
- Verification: old-code visible-button red reproduced; 0.5.13 exact-file import/buttons green, full offline Android 139/139 and independent rerun PASS. Signed APK package `com.smsmix.app` versionCode20/versionName0.5.13, commercial cert unchanged, SHA-256 `FD6D64FF873E51F67D1D6AA116E407DD0F10A68E79D95B5B2579D311A72E8A39`; copied and hash-verified at `C:/Users/User/Downloads/VSMS-v0.5.13-release.apk`. No live handset/SMS or web upload.
- Delivery: fix commit `55e69d16` pushed to `origin/main`; local signed APK delivered in Downloads. Next: user installs 0.5.13 and confirms the dialog button is visible and both editor fields fill on the actual handset.

# Previous active patch: VSMS combined import populates visible editors

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
