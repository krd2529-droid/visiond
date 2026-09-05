# Active patch: Delete individual Showcase products

- Status: PATCH_DELIVERED
- Report: the Showcase offers a page-wide delete action, but the intended action is deleting one chosen product from its own row.
- Outcome: remove the page-wide delete button and add a clear per-product delete button on every real Showcase row.
- Preserve: delete-all, pagination, search, grading, dynamic columns, and the existing TikTok Shop removal API.
- Acceptance: each real product row deletes only its own product after confirmation; analysis-only/demo rows cannot delete; focused Showcase and predeploy checks pass.
- Phase: implementation, focused Showcase, dynamic-column, Marketplace, mobile, predeploy, deployment, and production asset checks pass.
- Delivery: commit `7c824612` pushed to `origin/main`; production serves the per-row delete UI through `tiktok-analyzer.js?v=02053` (verified 2026-09-05).
