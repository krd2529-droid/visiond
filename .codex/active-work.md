# Active patch: Restore related-table button styling

- Status: PATCH_DELIVERED
- Report: the sold-products refresh button lost the app theme after being moved out of its original DOM container.
- Outcome: related-table action buttons use the same teal outline, typography, spacing, hover, and disabled treatment as adjacent controls.
- Preserve: refresh behavior, placement above its related table, Showcase controls, and responsive layout.
- Acceptance: no browser-default button styling; focused UI, mobile, and predeploy checks pass; duplicate Marketplace filter rule is removed.
- Phase: implementation, focused theme, TikTok sync, nine-queue, Marketplace, mobile, predeploy, deployment, and production asset checks pass.
- Delivery: commit `5853e590` pushed to `origin/main`; production serves the themed refresh button through `tiktok-analyzer.css?v=02054` (verified 2026-09-05).
