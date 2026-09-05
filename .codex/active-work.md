# Active patch: Remove Showcase next-review column

- Status: PATCH_DELIVERED
- Outcome: Remove the unused “ตรวจครั้งถัดไป” column from the Showcase product table.
- Preserve: stored review metadata, separate product review workflow, grading, GMV, search, pagination, and deletion.
- Acceptance: Showcase header and rows have nine matching columns; empty state spans nine columns; no review data is deleted.
- Likely files: TikTok analyzer client, regression test, visible version files.
- Phase: header/cells removed; tests and production verification passed while review workflow remains intact.
- Delivery: v0.20.46 pushed to origin/main and verified on visiondonline.com.
