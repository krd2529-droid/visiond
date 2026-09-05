# Active patch: Remove selected-range commission card

- Status: PATCH_READY
- Outcome: Remove the "ค่าคอมช่วงนี้" card from the TikTok Shop selected-date summary.
- Preserve: order count, sold-product grades/table, date filter, commission data elsewhere, sync, Showcase, and Marketplace.
- Acceptance: selected-date summary has no commission card or placeholder; order card and product table remain.
- Likely files: TikTok analyzer client, regression test, visible version files.
- Phase: implementation and regression checks passed.
- Delivery: test, review diff, commit only related files, push origin main, verify production.
