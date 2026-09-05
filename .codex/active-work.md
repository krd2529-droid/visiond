# Active patch: Settings-only TikTok Shop permission reconnect

- Status: PATCH_READY
- Report: the useful missing-permission reconnect card lived in channel analysis while settings used a different connection treatment; follow-up evidence shows the separate TikTok OAuth method is hidden after connection and is not visibly identified.
- Outcome: keep permission-specific reconnect in channel settings, expose a persistent and explicitly labeled TikTok OAuth card, and keep analysis free of connection controls.
- Preserve: initial connection, reconnect OAuth, disconnect, scope diagnostics, Marketplace permission gating, and channel selection.
- Acceptance: settings visibly identifies TikTok OAuth at all connection states; its action becomes connect/reconnect appropriately; missing-scope card remains inside `tiktokConnection`; analysis contains no connection/reconnect control; regression/mobile/predeploy checks pass.
- Phase: corrected implementation and regression verification complete.
- Verification: persistent TikTok OAuth card and reconnect state PASS; settings-only Shop permission reconnect PASS; simplified Marketplace UI PASS; Marketplace adversarial PASS; horizontal selector PASS; mobile frontend PASS; predeploy PASS (8 checks, 9 existing environment warnings); diff check clean.
- Delivery: prior partial revision `cb0f7eb3`; corrected delivery pending.
