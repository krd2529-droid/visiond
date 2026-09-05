# Active patch: Settings-only TikTok Shop permission reconnect

- Status: PATCH_DELIVERED
- Report: TikTok OAuth is connected, but the selected channel lacks an active TikTok Shop Creator OAuth connection; analysis still renders empty Shop-dependent panels and looks broken.
- Outcome: keep both OAuth methods explicit in settings; when Shop OAuth is absent, replace unusable analysis panels with a clear settings handoff instead of empty tables.
- Preserve: initial connection, reconnect OAuth, disconnect, scope diagnostics, Marketplace permission gating, and channel selection.
- Acceptance: settings visibly identifies both OAuth methods; analysis with no Shop connection hides sold products, Marketplace, and Showcase; it explains the missing Shop OAuth and navigates to its settings card without putting OAuth links in analysis; connected analysis remains unchanged; regression/mobile/predeploy checks pass.
- Phase: missing-connection flow implemented, tested, pushed, and verified on production.
- Verification: missing Shop OAuth gate PASS; OAuth settings cards PASS; Showcase readiness PASS; simplified Marketplace UI PASS; Marketplace adversarial PASS; horizontal selector PASS; mobile frontend PASS; predeploy PASS (8 checks, 9 existing environment warnings); diff check clean.
- Delivery: `5ff80772` on `origin/main`; production serves JS `02065` and CSS `02066` with the missing-Shop-OAuth analysis gate.
