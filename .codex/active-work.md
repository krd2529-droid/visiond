# Active patch: Show data dates in sold-products heading

- Status: PATCH_DELIVERED
- Outcome: show the selected `from` and `to` dates directly in the sold-products table heading.
- Preserve: date filter, order aggregation, grades, and product rows.
- Acceptance: heading reflects API `date_range`, uses readable DD/MM/YYYY, and updates after the date filter reloads.
- Phase: implementation, focused regression gates, push, cache-bust, and production verification complete.
- Delivery: commit `32dc2559`, production verified on 2026-09-05; sold-products heading reads its API date range as DD/MM/YYYY–DD/MM/YYYY.
