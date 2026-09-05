# Active patch: Per-product Showcase actions

- Status: CLOSED
- Report: angel-product results only have checkboxes and a bulk action whose label changes to a permission check, so the intended action is unclear.
- Outcome: add an explicit "เพิ่มเข้า Showcase" action to every product row and keep the bulk action wording stable.
- Preserve: selection checkboxes, bulk add, shop-search isolation, real TikTok permission enforcement, pagination, and result data.
- Acceptance: every product row has an add button; a permitted click adds only that product; missing permission explains the Partner Center requirement without renaming the action; bulk selection remains functional.
- Phase: implementation complete; per-row, bulk, permission, adversarial, mobile, and predeploy checks passed.
- Delivery: committed as 47eb39b8, pushed to origin/main, and verified on production.
