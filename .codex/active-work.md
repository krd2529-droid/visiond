# Active patch: Separate Marketplace product and shop search

- Status: PATCH_READY
- Report: product keyword and shop name search are visually mixed in one Marketplace form with one ambiguous action.
- Outcome: separate product search and shop-name search into distinct blocks with actions named `ค้นหาสินค้า` and `ค้นหาชื่อร้านค้า`.
- Preserve: shared sort/order, advanced filters, pagination, snapshots, category loading, permission gating, and Marketplace results.
- Search rule: each action sends only its own query type; pagination preserves the selected search mode.
- Acceptance: two visually distinct search blocks; correctly named buttons; product search omits shop keyword; shop search omits product keyword; both buttons share loading/permission state; responsive/regression/predeploy checks pass.
- Phase: implementation and regression verification complete.
- Verification: separated-search, responsive Marketplace layout, adversarial Marketplace, simplified Marketplace UI, Showcase readiness, mobile frontend, predeploy, and diff checks passed.
- Delivery: pending commit, push, and production verification.
