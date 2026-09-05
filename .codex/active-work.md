# Active patch: Remove Marketplace heading description

- Status: PATCH_DELIVERED
- Report: the sentence below `ค้นหาสินค้านางฟ้า` is not useful to the user.
- Outcome: remove that description completely so search controls follow the heading directly.
- Preserve: Marketplace API, product/shop search modes, filters, results, Showcase actions, and styling.
- Acceptance: description is absent; heading and all search behavior remain; regression and predeploy checks pass.
- Phase: delivered.
- Verification: description-removal regression, Marketplace separation, Showcase readiness, predeploy, diff, and production checks passed.
- Delivery: commit `76905425` is on `origin/main`; production retains `ค้นหาสินค้านางฟ้า` and no longer contains the removed description.
