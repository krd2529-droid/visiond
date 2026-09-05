# Active patch: Restore related-table button styling

- Status: PATCH_READY
- Report: the sold-products refresh button lost the app theme after being moved out of its original DOM container.
- Outcome: related-table action buttons use the same teal outline, typography, spacing, hover, and disabled treatment as adjacent controls.
- Preserve: refresh behavior, placement above its related table, Showcase controls, and responsive layout.
- Acceptance: no browser-default button styling; focused UI, mobile, and predeploy checks pass; duplicate Marketplace filter rule is removed.
- Phase: implementation and focused theme, TikTok sync, nine-queue, Marketplace, mobile, and predeploy checks pass; commit/push and production verification in progress.
- Delivery: pending.
