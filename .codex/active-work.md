# Active patch: Move channel selector above workspace

- Status: PATCH_DELIVERED
- Report: the vertical My Channels sidebar consumes width needed by settings and analysis content.
- Outcome: My Channels becomes a compact full-width selector above the workspace; channel cards flow horizontally; the workspace uses the full content width.
- Preserve: channel selection/add/delete behavior, active state, settings/analysis tabs, all workspace content, and mobile usability.
- Acceptance: desktop main is one column; selector precedes workspace; channel cards are horizontal; <=850px stacks selector content without moving it below workspace; layout/mobile/predeploy checks pass.
- Phase: implemented, tested, pushed, and verified on production.
- Verification: selector layout PASS; supported columns PASS; related-button style PASS; mobile frontend PASS; predeploy PASS (8 checks, 9 existing environment warnings); diff check clean.
- Delivery: `adfae984` on `origin/main`; production serves cache key `02058` and the horizontal selector rules.
