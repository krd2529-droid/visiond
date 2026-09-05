# Active patch: Hide empty Showcase columns

- Status: PATCH_DELIVERED
- Outcome: Automatically omit Showcase columns for which TikTok/analysis provides no real values.
- Preserve: product identity/image, any columns that do contain data, search, stable pagination, deletion, and stored records.
- Acceptance: column visibility is calculated from all filtered products so it does not jump between pages; headers and row cells use the same visibility map; empty-row colspan is calculated; the GMV note is hidden when no GMV fields are shown.
- Likely files: TikTok analyzer client, regression tests, visible version files.
- Phase: implementation, focused regressions, version parity, and predeploy checks passed.
- Delivery: v0.20.47 committed as 24173abb, pushed to origin/main, and verified on visiondonline.com.
