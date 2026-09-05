# Active patch: TikTok marketplace category picker

- Status: PATCH_READY
- Outcome: Simplify the TikTok Shop workflow: replace Category ID with a category-name selector, select channels only from the left cards, remove manual Showcase product-ID entry, and remove unused TikTok clip sync/disconnect controls.
- Preserve: keyword, sorting, price, commission, result-limit, comparison-period, snapshot, and Showcase workflows.
- Data source: category ID/name pairs returned with TikTok Open Collaboration products; never fabricate category mappings.
- Acceptance: no editable Category ID field; selector shows TikTok category names and submits IDs internally; left cards are the sole channel selector; Showcase additions come only from Marketplace selection; no clip-sync button or its TikTok disconnect control; TikTok Shop refresh/disconnect remain clearly named.
- Likely files: TikTok Shop API normalizer, marketplace UI, regression tests, visible version files.
- Phase: implementation and regression checks passed; ready to commit and deploy.
- Delivery: test, review diff, commit only related files, push origin main, verify production.
