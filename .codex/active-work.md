# Active patch: Remove Showcase next-review column

- Status: PATCH_READY
- Outcome: Remove the unused “ตรวจครั้งถัดไป” column from the Showcase product table.
- Preserve: stored review metadata, separate product review workflow, grading, GMV, search, pagination, and deletion.
- Acceptance: Showcase header and rows have nine matching columns; empty state spans nine columns; no review data is deleted.
- Likely files: TikTok analyzer client, regression test, visible version files.
- Phase: header/cells removed and empty-row span corrected; focused and pre-deployment checks passed.
- Delivery: test, review diff, commit only related files, push origin main, verify production.
