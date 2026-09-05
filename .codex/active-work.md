# Active patch: Simplify Marketplace heading

- Status: PATCH_DELIVERED
- Report: the heading `ค้นหา Open Collaboration Marketplace` is unnecessarily technical.
- Outcome: show the plain-language heading `ค้นหาสินค้านางฟ้า`.
- Preserve: Marketplace API, product/shop search modes, filters, results, Showcase actions, and styling.
- Acceptance: new heading appears once; old heading is absent; regression and predeploy checks pass.
- Phase: delivered.
- Verification: heading regression, Marketplace separation, Showcase readiness, predeploy, and diff checks passed.
- Delivery: commit `0fabf174` is on `origin/main`; production displays `ค้นหาสินค้านางฟ้า` and no longer contains the old technical heading.
