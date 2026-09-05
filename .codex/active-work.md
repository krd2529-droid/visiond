# Active patch: Settings-only TikTok Shop permission reconnect

- Status: PATCH_READY
- Report: a connected Shop account with incomplete Showcase scope is worded like a failed connection, while reconnect and disconnect controls are split across unrelated cards.
- Outcome: group Shop permission status, reconnect, and disconnect inside one TikTok Shop Creator OAuth card; explicitly distinguish connected status from missing write scope.
- Preserve: initial connection, reconnect OAuth, disconnect, scope diagnostics, Marketplace permission gating, and channel selection.
- Acceptance: incomplete-scope message begins with connected status; permission warning is nested in `shopConnectionManagement`; reconnect and disconnect share the same action row; ready accounts hide reconnect; missing accounts show initial connect; prior analysis gate remains; regression/mobile/predeploy checks pass.
- Phase: grouped Shop OAuth controls implemented and regression verification complete.
- Verification: connected-vs-missing-scope wording PASS; grouped reconnect/disconnect PASS; missing Shop OAuth analysis gate PASS; Showcase readiness PASS; Marketplace UI/adversarial PASS; mobile frontend PASS; predeploy PASS (8 checks, 9 existing environment warnings); diff check clean.
- Delivery: prior revision `5ff80772`; grouped Shop OAuth controls pending.
