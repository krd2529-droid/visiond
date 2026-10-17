# VSMS — v0.5.2

## VisionD licensing integration — PATCH_READY (release gate pending)

Imported supplied VSMS v0.5.2 source and retained its foreground service, delivery status, link libraries, queue/history, and UI. Added VisionD key activation and online checks before queue resume and each SMS handoff, with queue race guards and fail-closed pause. Server binds the first device until explicit admin reset; paid 30/365-day offers are 999/9,999 THB, with no trial or direct admin issuance. Ordinary copied app data produces a different Android ID-derived device hash; modified/rooted clients may still spoof a self-asserted ID, so this is copy resistance rather than an absolute guarantee. R8 is enabled for release builds. Production release requires a securely signed APK and certificate/data migration decision; no real SMS testing performed.

## v0.5.2 — PATCH_STARTED
User requested VSMS logo. Added native vector wordmark, adaptive launcher icon, main-screen logo and VSMS labels; application ID and SMS behavior preserved. Build/lint and signed APK/source packaging in progress.

## v0.5.1 — PATCH_STARTED / PATCH_UPDATED
Show drawn numbers and send outcomes. Confirmed send failure waits random 5–10 minutes then advances to next pending number without retry; success stays 10–30 minutes. Stop and queue completion respected. Unknown send outcomes still pause. Persist separate success-only phone/link/time archive and CSV export across campaigns. Add carrier delivery reports for current queue, never claim SMS read receipts (unsupported by SMS). Verify failure/multipart/stop timing, archive dedup/filter/retention, delivery aggregation and unavailable reports, full tests/build/lint, package APK/source. No real SIM test.

## v0.5.1 — PATCH_READY / PATCH_DELIVERED
Implemented requested number/status display, confirmed-failure continuation, successful phone/link archive and CSV, current-queue multipart delivery receipts. SMS read receipts unavailable; explicitly labeled in app and docs. 57 tests pass, core 20,027 checks pass, build/lint pass (0 errors, 13 warnings), APK signature v2 matches previous release. VersionCode8/versionName0.5.1. Deliverables ../apk/SMS-Mix-v0.5.1-debug.apk and SMS-Mix-v0.5.1-source.zip; evidence verification/v0.5.1. Real SIM receipts and Doze untested. Receipt arriving after queue replacement is ignored; older success archive remains. Doze may defer requested 5–10 minute alarm. Unknown send outcomes pause rather than fabricated failure.
PATCH_DELIVERED: random recipient selection from files and inclusive numeric ranges, with durable shared no-repeat history.

Requirements satisfied:
- File mode: normalize/deduplicate imported CSV/TXT numbers, exclude prior draws, randomly select without replacement.
- Range mode: inclusive start/end and requested count 1–10,000, no enumeration of the full range; validates endpoints and available count.
- Shared history across modes, overlapping ranges, changed files, queue replacement and reload.
- History is reserved at successful queue creation, including unsent numbers. Cancelling or invalid input does not consume numbers or replace the existing queue.
- History and queue saved in one AtomicFile transaction. Surviving v0.1.0 queue seeds history on upgrade.
- Existing SMS controls, 10–100 caption/link pools, random pairing, selected SIM, random 10–30 minute delays, pause and resume retained.
- APK/source delivered separately in ../apk and this source directory, plus v0.2.0 source ZIP.

Verification:
- Gradle testDebugUnitTest assembleDebug lintDebug: BUILD SUCCESSFUL.
- 24 tests, 0 failures/errors: 13 existing SMS tests; 6 sampler tests covering all exclusion subsets, normalization, overlaps, exhaustion, invalid ranges, 10,000 selections from a huge interval and randomized order; 5 history/UI tests covering reload/cross-mode persistence, legacy migration, invalid/active queue protection, corrupt history and cancelled/confirmed UI replacement.
- Android lint: 0 errors, 8 warnings; report in verification/v0.2.0/.
- APK v2 signature valid and signing certificate matches v0.1.0. Package com.smsmix.app, versionCode 2, versionName 0.2.0, minSdk 26/targetSdk 35.
- Reviewed UI diff against v0.1.0 source archive. No Git repository; no commit/push applicable.

Limitations:
- Debug APK. No physical SIM/carrier or device power-management test performed.
- Clearing app data or uninstalling deletes local history; install update over previous version.
- v0.1.0 queues overwritten before upgrade cannot be reconstructed.
- Generated numbers have valid configured format, not verified ownership/existence.
- Actual scheduling remains subject to Android/OEM limitations documented in README.

Previous delivery: v0.1.0 delivered with file imports and SMS queue; original artifacts retained.

## Active v0.3.0 — PATCH_STARTED
Add named caption sets: save current 10–100 captions under a nonempty name, select saved set to fill editor, persist across restart. Confirm overwriting an existing name and replacing unsaved editor text. Existing links, queues, history and SMS behavior preserved. Separate atomic caption-library file. Validate storage/UI and regressions; deliver matching APK and source ZIP.

## v0.3.0 — PATCH_DELIVERED
Named caption sets implemented: save 10–100 captions under a trimmed 1–60 character name, choose a saved set into the editor, confirm duplicate-name overwrite and replacement of nonempty editor text. Separate AtomicFile caption-library.json persists across reopen; corrupt libraries are not silently overwritten.
Unchanged: links, current queue/messages, recipient history, both sampling modes, SIM and delay behavior.
Verification: testDebugUnitTest assembleDebug lintDebug BUILD SUCCESSFUL; all 30 tests pass (24 previous plus 6 caption storage/UI tests). UI tests cover save/select/reopen, unchanged links, cancel overwrite and cancel/confirm editor replacement. Reviewed MainActivity diff against v0.2.0 archive.
APK: com.smsmix.app 0.3.0 / versionCode 3, signature verified and matches v0.2.0 for in-place update.
Delivery: ../apk/SMS-Mix-v0.3.0-debug.apk and SMS-Mix-v0.3.0-source.zip. Evidence: verification/v0.3.0/.
Debug/device-test limitations from above remain. No live SMS sent. Install over previous version; clearing data/uninstalling removes the local library/history.

## Active v0.4.0 — PATCH_STARTED
Add Shrinkrl integration: one HTTP(S) destination, requested quantity 1–100, distinct short URLs, explicit apply to link editor. Preserve existing caption sets/recipient history/SMS behavior. Use documented bulk API https://api.shrinkrl.com/api/v1/urls/bulk_create and per-item custom slugs, rate limits respected; no bypass. Persist latest request/results, retry same slugs after partial/uncertain outcomes, report actual counts. Android internet permission needed; only supplied destination goes to provider. Verify parser/error cases, UI import, live small example.com request, regressions/build/signatures; deliver two folders.
Reference: https://www.shrinkrl.com/api (inspected this turn).

PATCH_UPDATED: user requires every named link set to retain the original destination AND all successfully generated short URLs. Add persistent named link library, detail view showing both, and explicit use of short URLs. Finish existing v0.4.0; not a new patch.
Live finding: bulk retry returns slug-taken errors rather than existing records. Recovery must GET missing requested slugs and verify original_url before accepting; do not invent links or change slugs on retry.

## v0.4.0 — PATCH_DELIVERED
Implemented Shrinkrl generation (one original URL, 1–100 distinct short links), actual-count reporting, persisted latest request/results, manual retry and verified lookup recovery after bulk slug collisions. No automatic repeated create loop or limit bypass.
Named link sets store original_url, every successful short URL, requested count, and saved timestamp. Save from the generation screen; inspect original/all short URLs and apply a saved set from either screen. Overwrites and replacing existing editor text require confirmation. Saved sets survive new jobs and app restart.
Manifest adds INTERNET; only destination and requested slug data are sent to Shrinkrl. Existing recipients, captions and queued SMS are not uploaded or modified.

Verification:
- testDebugUnitTest assembleDebug lintDebug: BUILD SUCCESSFUL.
- 44 tests, 0 failures/errors (30 regression + 7 client/parser/recovery + 7 library/UI cases).
- Covers unique 1–100 requests; URL validation; malformed/partial responses; duplicate/wrong destination/host rejection; collision recovery; stop on lookup failure; original plus all 100 short URLs preserved; actual/requested counts; overwrite/corrupt-storage protection; save/choose/reopen/import/cancel flows.
- Live API: two distinct example.com short links created; repeated bulk request returned slug-taken; GET lookup recovered both with exact matching destination. The two temporary test links were deleted with HTTP 204. Evidence in verification/v0.4.0/.
- Android lint: 0 errors, 10 warnings (see report).
- APK signature valid; same certificate as v0.3.0. Package com.smsmix.app, versionCode 4, v0.4.0, minSdk26/targetSdk35.
- MainActivity diff reviewed against v0.3.0 source archive. No Git repository.

Delivery: ../apk/SMS-Mix-v0.4.0-debug.apk and SMS-Mix-v0.4.0-source.zip.
Limitations: debug APK; no physical-device SMS or phone-network verification. Provider availability/rate limits apply. If Android kills generation process, reopen and manually retry saved request. Link sets are snapshots: save again after obtaining additional results. Clear-data/uninstall deletes local sets/history; update in place.

## v0.4.1 — PATCH_STARTED
Add section-2 original URL input and save action for manually pasted short links. Reuse current link editor (1–100 distinct links per saved set; SMS pool remains 10–100). Persist draft original; named-set overwrite confirmation retained. Manual sets accept HTTP(S) short URLs from any provider and explicitly store source=manual; provider-generated sets keep existing domain validation. No network requests or destination verification for manual saves.
Acceptance: storage round trip, invalid input/count boundaries, original+all pasted URLs kept, UI save/reopen/use, generated-library regression, APK/source delivery.

## v0.4.1 — PATCH_DELIVERED
Section 2 supports an original-URL field plus pasted short links and a named save button. Manual bundles retain the original and all unique pasted HTTP(S) URLs (1–100), source=manual; generated-bundle domain validation unchanged. Saved bundle selection on the main screen restores original and short URLs together. Manual draft original persists. Existing overwrite and editor-replacement confirmations retained. No network calls for manual saves.
Verification: testDebugUnitTest assembleDebug lintDebug BUILD SUCCESSFUL; 47 tests pass (44 regression + 3 manual storage/validation/UI-reopen cases). Reviewed changed code and diff scope for MainActivity, LinkLibrary, LinkSetDialogs. Signature matches v0.4.0; com.smsmix.app versionCode 5 / v0.4.1.
Delivery: ../apk/SMS-Mix-v0.4.1-debug.apk and SMS-Mix-v0.4.1-source.zip. Evidence verification/v0.4.1/.
Existing debug/physical-SIM-test limitations remain. Manual link destinations are user-supplied and not resolved/verified against the provided original. Update in place to retain local data.

## v0.4.2 — PATCH_STARTED
User screenshot reports HTTP validation when saving pasted short links with original field blank. Remove HTTP/scheme/host validation for manually entered links and SMS pools; make manual original optional. Preserve input text apart from trimming/deduplication, preserve existing count bounds and generated-provider response checks. Reproduce screenshot and scheme-free save/queue cases, then verify full build/tests and deliver APK/source.

## v0.4.2 — PATCH_DELIVERED
Root cause confirmed: LinkLibrary.manual validated the blank original through ShortLinkClient.destination before processing valid pasted short URLs; library reload and CampaignCore also imposed URL format validation. Two regression tests reproduced HTTP validation failures before changes.
Fix: manual original optional; manual originals/links retained as text (trimmed), no HTTP/scheme/host validation in manual save/load or campaign link pool. Counts, deduplication, persistence and provider-generated result checks retained. Original field hint marks it optional.
Verification: both failing regression cases now pass; full 49 Android/unit tests pass; standalone core PASS 20,027; assembleDebug/lintDebug BUILD SUCCESSFUL. Evidence verification/v0.4.2/. Changed validation/UI code reviewed; no temporary debug logging.
APK com.smsmix.app v0.4.2/versionCode6, signature verified and matches v0.4.1 for update-in-place.
Delivery: ../apk/SMS-Mix-v0.4.2-debug.apk and SMS-Mix-v0.4.2-source.zip.
Scope: manual entry and queue validation. Shrinkrl API destination/response checks remain for that service. No physical-device SMS test performed; other documented limitations unchanged.

## v0.5.0 — PATCH_STARTED
User requires sending while minimized/screen off/sleep until stopped, plus visible per-recipient success. Add user-started specialUse foreground service, ongoing stop notification, persisted alarm restoration on service restart, battery/notification setup, detailed auto-refresh status list with time and filters. Keep exact idle-capable alarms and no-duplicate/error-stop behavior. Boot remains paused (device reboot distinct from screen sleep); completion/errors also stop. Physical OEM Doze behavior cannot be guaranteed without handset testing; disclose this.
Verification: service lifecycle/restoration, stop notification, paused/completed service no sends, per-row final status/timestamps, existing regressions; SDK manifest/build/lint, matching signed APK and source.
References inspected: developer.android.com/develop/background-work/services/fgs/service-types and developer.android.com/training/monitoring-device-state/doze-standby.

## v0.5.0 — PATCH_UPDATED
Implemented foreground specialUse service, sticky queue alarm restoration, stop notification with campaign-id guard, battery setup, notification permission, auto-refresh recipient status with filters and result timestamps, CSV result_at. Existing manual link format-validation removal preserved. No real SMS or handset Doze test performed.

## v0.5.0 — PATCH_READY / PATCH_DELIVERED
Build testDebugUnitTest assembleDebug lintDebug passed. 53 Robolectric tests, 20,027 core checks; lint 0 errors (14 warnings). APK v2 signature verified, versionCode 7/versionName 0.5.0. Delivered apk/SMS-Mix-v0.5.0-debug.apk and source/SMS-Mix-v0.5.0-source.zip. Test evidence verification/v0.5.0. Physical handset/SIM/Doze behavior remains untested; setup and limits documented in README.

## v0.5.2 — PATCH_DELIVERED
assembleDebug and lintDebug passed. Signature verified. VSMS adaptive launcher and main-screen vector logo added. Delivered ../apk/VSMS-v0.5.2-debug.apk and VSMS-v0.5.2-source.zip. Branding-only change; no new SMS behavior or handset test.
