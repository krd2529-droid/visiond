# Active patch: Remove discarded products from selection list

- Status: PATCH_DELIVERED
- Report: clicking discard updates the database/history but the product remains visible in the analysis snapshot list.
- Root cause: the product-prep cards render from an older analysis snapshot and are not reconciled with current `inventory_status` records.
- Outcome: discarded products disappear from the selection list immediately and remain absent after reopening the channel; visible ranks and grade totals are recalculated.
- Preserve: discarded history, restore/retest workflows, kept products, analysis snapshots, and API status updates.
- Acceptance: both newly discarded and already-discarded products are filtered; selection ranks/totals update; focused inventory, mobile, and predeploy checks pass.
- Phase: root cause confirmed; client reconciliation implemented; focused discarded-state, title, permission, syntax, mobile, predeploy, deployment, and production asset checks pass.
- Delivery: commit `599d1dec` pushed to `origin/main`; production serves discarded-product reconciliation through `tiktok-analyzer.js?v=02056` (verified 2026-09-05).
