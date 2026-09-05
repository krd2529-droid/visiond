# Active patch: Remove Showcase delete-all action

- Status: PATCH_DELIVERED
- Report: the Showcase footer still exposes a destructive `ลบสินค้าทั้งหมด` action that the user no longer wants.
- Outcome: remove the delete-all control and its browser event path.
- Preserve: per-row `ลบรายการนี้`, confirmation, batching/error handling used by row deletion, Showcase rendering, search, and pagination.
- Acceptance: no delete-all element, label, selector, or trigger remains; each eligible Showcase row still has its own delete button; regressions and predeploy checks pass.
- Phase: delivered.
- Verification: row-only deletion, manual-C placement, Marketplace separation, Showcase readiness, mobile frontend, predeploy, and diff checks passed.
- Delivery: commit `80f91496` is on `origin/main`; production HTML/JS/CSS cache keys `02072`/`02071` contain no delete-all control or selector and retain per-row deletion.
