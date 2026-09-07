# Active patch: Storefront login parity and boss mobile preview lifecycle

- Event: PATCH_READY
- Outcome: Login and registration share the existing button treatment, with separate login-link and signup-link classes and shared CSS selectors; login precedes registration. Mobile preview exists only for a server-confirmed boss on eligible desktop storefronts.
- Phase: implementation and local verification complete; scoped commit/push and production verification pending Jarvis review.
- Authorization: /api/auth/me supplies session expiry from the same indexed session/user query, opt-in only; response is private, no-store. Shared auth-session uses one in-flight request and 30-second memory TTL, never trusts localStorage roles, and performs no background polling.
- Lifecycle: pending/error/non-boss responses have zero preview DOM. Exact server expiry removes launcher and overlay, long timers rearm safely. Logout immediately revokes and latches across tabs and pending requests until fresh authentication; hidden tabs suppress preview and return uses valid memory cache.
- Files: shared-nav, auth-session, boss-mobile-preview, nav-account, all existing logout entrypoints, /auth/me and optional currentUser expiry projection; dependency cache keys propagated through public importers; version v0.20.57 and focused regressions.
- Verified: test:v02057 (roles, malformed/error/pending responses, request dedup, TTL, expiry, logout races, cross-tab latch, visibility, private response, one-query indexed EXPLAIN); v02054 catalog, v02055 login reliability, v02056 guides, admin-product-d1-efficiency, syntax and visible-version parity passed. Historical tests updated only for current asset/version keys.
- Independent Mark evidence: .tmp-codex/mark-nav-qa/race.mjs now bossRecreated:false and calls:1; browser guest/user/admin preview DOM0, boss opens iframe, six-second expiry removes all preview DOM, desktop1280 buttons39px and mobile390 buttons46px with no overflow.
- Deferred separate gate: actual TikTok reviewer-account validation remains subject to its existing D1-reset gate.
- Next action: Jarvis review, commit and push only task-related files to origin main, then verify deployed v0.20.57 and production flows. Do not mark delivered before production evidence.
