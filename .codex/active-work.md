# Active patch: Add page/all Showcase deletion

- Status: PATCH_READY
- Outcome: Replace selected-item deletion with “ลบสินค้าในหน้านี้” and “ลบสินค้าทั้งหมด”.
- Preserve: product search, grade ordering, GMV data, pagination, account isolation, and TikTok API limits.
- Safety: confirm the exact count; delete in batches of at most 200; report partial completion if a later batch fails.
- Acceptance: page deletion targets only the currently rendered real Showcase products; all deletion targets every loaded product for the selected Creator account; obsolete checkboxes are removed.
- Likely files: TikTok analyzer client/HTML/CSS, regression tests, visible version files.
- Phase: page/all deletion, 200-item batching, account locking, confirmation, partial-failure reporting, and regression checks passed.
- Delivery: test, review diff, commit only related files, push origin main, verify production.
