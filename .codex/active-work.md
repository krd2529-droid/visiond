# Active patch: Grade synced TikTok Shop products

- Status: PATCH_READY
- Outcome: Show a clear sales-based grade for every product in the selected-date sold-products table.
- Grade source: authoritative TikTok Shop order count in the selected date range; A >= 30, B >= 16, C >= 1.
- Preserve: sync, date filtering, Showcase grading, Marketplace, OAuth, and account binding behavior.
- Acceptance: sold-products table includes a colored grade column and explanation; grading logic is shared with Showcase; no invented grade when no orders exist.
- Likely files: TikTok analyzer client/CSS, regression test, visible version files.
- Phase: implementation and regression checks passed.
- Delivery: test, review diff, commit only related files, push origin main, verify production.
