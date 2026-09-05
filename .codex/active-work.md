# Active patch: Settings-only TikTok Shop permission reconnect

- Status: PATCH_DELIVERED
- Report: the useful missing-permission reconnect card lived in channel analysis while settings used a different connection treatment.
- Outcome: move the permission-specific reconnect card into channel settings and keep analysis free of connection controls.
- Preserve: initial connection, reconnect OAuth, disconnect, scope diagnostics, Marketplace permission gating, and channel selection.
- Acceptance: missing-scope card is rendered inside `tiktokConnection`; its reconnect action targets the selected channel; analysis contains no connection/reconnect control; no duplicate reconnect action appears in settings; regression/mobile/predeploy checks pass.
- Phase: implemented, tested, pushed, and verified on production.
- Verification: Showcase readiness PASS; Marketplace adversarial PASS; simplified Marketplace UI PASS; horizontal selector PASS; mobile frontend PASS; predeploy PASS (8 checks, 9 existing environment warnings); diff check clean.
- Delivery: `cb0f7eb3` on `origin/main`; production serves JS `02061` and CSS `02062` with settings-only permission reconnect.
