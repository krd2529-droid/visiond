# Active patch: Settings-only TikTok Shop permission reconnect

- Status: PATCH_READY
- Report: TikTok OAuth is connected, but the selected channel lacks an active TikTok Shop Creator OAuth connection; analysis still renders empty Shop-dependent panels and looks broken.
- Outcome: keep both OAuth methods explicit in settings; when Shop OAuth is absent, replace unusable analysis panels with a clear settings handoff instead of empty tables.
- Preserve: initial connection, reconnect OAuth, disconnect, scope diagnostics, Marketplace permission gating, and channel selection.
- Acceptance: settings visibly identifies both OAuth methods; analysis with no Shop connection hides sold products, Marketplace, and Showcase; it explains the missing Shop OAuth and navigates to its settings card without putting OAuth links in analysis; connected analysis remains unchanged; regression/mobile/predeploy checks pass.
- Phase: missing-connection flow implemented and regression verification complete.
- Verification: missing Shop OAuth gate PASS; OAuth settings cards PASS; Showcase readiness PASS; simplified Marketplace UI PASS; Marketplace adversarial PASS; horizontal selector PASS; mobile frontend PASS; predeploy PASS (8 checks, 9 existing environment warnings); diff check clean.
- Delivery: prior UI revision `00c7b12a`; corrected missing-connection flow pending.
