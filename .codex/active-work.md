# Active patch: Remove selected-range commission card

- Status: PATCH_DELIVERED
- Outcome: Remove the "ค่าคอมช่วงนี้" card from the TikTok Shop selected-date summary.
- Preserve: order count, sold-product grades/table, date filter, commission data elsewhere, sync, Showcase, and Marketplace.
- Acceptance: selected-date summary has no commission card or placeholder; order card and product table remain.
- Likely files: TikTok analyzer client, regression test, visible version files.
- Phase: implementation, regression checks, and production verification passed.
- Delivery: v0.20.39 pushed to origin/main and verified on visiondonline.com.
