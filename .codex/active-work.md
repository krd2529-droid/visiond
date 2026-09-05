# Active patch: Remove obsolete Showcase sort controls

- Status: PATCH_READY
- Outcome: Remove the “ดูสินค้า GMV โตสูง” and “เรียงตามเกรด” buttons from the Showcase UI.
- Preserve: product search, default grade ordering, GMV data, pagination, and all TikTok workflows.
- Acceptance: neither button is rendered; no JavaScript looks up or binds the removed controls; Showcase remains ordered by grade and searchable.
- Likely files: TikTok analyzer client/CSS, regression tests, visible version files.
- Phase: controls, handlers, and obsolete styles removed; focused and pre-deployment checks passed.
- Delivery: test, review diff, commit only related files, push origin main, verify production.
