# Active patch: Marketplace search separation and hidden analysis history

- Status: PATCH_READY
- Report: product keyword and shop name search are visually mixed in one Marketplace form with one ambiguous action.
- Outcome: separate product search and shop-name search into distinct blocks with actions named `ค้นหาสินค้า` and `ค้นหาชื่อร้านค้า`.
- Preserve: shared sort/order, advanced filters, pagination, snapshots, category loading, permission gating, and Marketplace results.
- Search rule: each action sends only its own query type; pagination preserves the selected search mode.
- Acceptance: two visually distinct search blocks; correctly named buttons; product search omits shop keyword; shop search omits product keyword; both buttons share loading/permission state; responsive/regression/predeploy checks pass.
- Added removal: do not render analysis-history disclosure or its run list on this page; preserve stored history and continue using the latest run as the selected channel result.
- Phase: history UI removal and verification complete.
- Verification: hidden-history regression, separated Marketplace search, Marketplace layout/adversarial behavior, Showcase readiness, mobile frontend, predeploy, and diff checks passed.
- Delivery: Marketplace separation commit `36156e4e` is on `origin/main`; history-removal commit and production verification pending.
