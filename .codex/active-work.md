# Active patch: Remove obsolete Showcase sort controls

- Status: PATCH_DELIVERED
- Outcome: Remove the “ดูสินค้า GMV โตสูง” and “เรียงตามเกรด” buttons from the Showcase UI.
- Preserve: product search, default grade ordering, GMV data, pagination, and all TikTok workflows.
- Acceptance: neither button is rendered; no JavaScript looks up or binds the removed controls; Showcase remains ordered by grade and searchable.
- Likely files: TikTok analyzer client/CSS, regression tests, visible version files.
- Phase: controls, handlers, and obsolete styles removed; tests and production verification passed.
- Delivery: v0.20.42 pushed to origin/main and verified on visiondonline.com.
