# Active patch: Repair Marketplace search layout

- Status: PATCH_DELIVERED
- Report: Marketplace search fields are compressed and misaligned after adding shop-name search.
- Outcome: product/shop searches occupy a balanced first row; sort/order/search button occupy a clear second row; mobile uses one column.
- Preserve: field IDs, search behavior, filters, snapshot, and results.
- Acceptance: no overlapping text at desktop/tablet/mobile widths; controls remain in logical reading order; focused CSS regression and production asset verification pass.
- Phase: responsive CSS, Marketplace regression, mobile audit, predeploy gates, deployment, and production asset verification pass.
- Delivery: commit `c9bba08a` pushed to `origin/main`; production serves `tiktok-analyzer.css?v=02051` (verified 2026-09-05).
