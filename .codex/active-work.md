# Active patch: Show data dates in sold-products heading

- Status: PATCH_READY
- Outcome: show the selected `from` and `to` dates directly in the sold-products table heading.
- Preserve: date filter, order aggregation, grades, and product rows.
- Acceptance: heading reflects API `date_range`, uses readable DD/MM/YYYY, and updates after the date filter reloads.
- Phase: implementation and focused regression gates pass; commit/push and production verification in progress.
- Delivery: pending.
