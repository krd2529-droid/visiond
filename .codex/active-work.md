# Active patch: Clarify shop-search result limit

- Status: PATCH_READY
- Report: the 200-result Marketplace note appears detached and does not explain which feature it belongs to.
- Outcome: place a plain-language note inside the shop-name search block, visually separated below its input and action.
- Preserve: Marketplace API, product/shop search modes, filters, results, Showcase actions, and styling.
- Acceptance: note clearly says it belongs to shop-name search and the 200-item limit; it is not nested inside the input label; product/shop search and responsive layouts remain intact.
- Phase: implementation and verification complete.
- Verification: shop-note association, separated search, responsive layout, Marketplace adversarial flow, Showcase readiness, manual-C placement, mobile frontend, predeploy, and diff checks passed.
- Delivery: pending commit, push, and production verification.
