# Active patch: Separate shop search from angel-product search

- Status: CLOSED
- Report: shop-name search is nested in the angel-product search form and both workflows share submit mode and result state.
- Outcome: give shop-name search its own block, form, request path, status, results, pagination, and Showcase selection action.
- Preserve: Marketplace API, filters, product search, shop search, creator-density data, and Showcase permission checks.
- Acceptance: submitting one search never reads, resets, disables, or overwrites the other search; each result list paginates and selects independently; blocks remain responsive.
- Phase: implementation complete; separated-flow, adversarial, permission, responsive, and predeploy checks passed.
- Delivery: committed as ad2151ea, pushed to origin/main, and verified on production.
