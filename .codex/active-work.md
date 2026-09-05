# Active patch: Add page/all Showcase deletion

- Status: PATCH_DELIVERED
- Outcome: Replace selected-item deletion with “ลบสินค้าในหน้านี้” and “ลบสินค้าทั้งหมด”.
- Preserve: product search, grade ordering, GMV data, pagination, account isolation, and TikTok API limits.
- Safety: confirm the exact count; delete in batches of at most 200; report partial completion if a later batch fails.
- Acceptance: page deletion targets only the currently rendered real Showcase products; all deletion targets every loaded product for the selected Creator account; obsolete checkboxes are removed.
- Likely files: TikTok analyzer client/HTML/CSS, regression tests, visible version files.
- Phase: page/all deletion, safety checks, regression tests, and production verification passed.
- Delivery: v0.20.43 pushed to origin/main and verified on visiondonline.com.
