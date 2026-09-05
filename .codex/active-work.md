# Active patch: Marketplace search separation and hidden analysis history

- Status: PATCH_DELIVERED
- Report: product keyword and shop name search are visually mixed in one Marketplace form with one ambiguous action.
- Outcome: separate product search and shop-name search into distinct blocks with actions named `ค้นหาสินค้า` and `ค้นหาชื่อร้านค้า`.
- Preserve: shared sort/order, advanced filters, pagination, snapshots, category loading, permission gating, and Marketplace results.
- Search rule: each action sends only its own query type; pagination preserves the selected search mode.
- Acceptance: two visually distinct search blocks; correctly named buttons; product search omits shop keyword; shop search omits product keyword; both buttons share loading/permission state; responsive/regression/predeploy checks pass.
- Added removal: do not render analysis-history disclosure or its run list on this page; preserve stored history and continue using the latest run as the selected channel result.
- Phase: delivered.
- Verification: hidden-history regression, separated Marketplace search, Marketplace layout/adversarial behavior, Showcase readiness, mobile frontend, predeploy, and diff checks passed.
- Delivery: Marketplace separation commit `36156e4e` and history-removal commit `5892999d` are on `origin/main`; production `https://visiondonline.com/tiktok-analyzer` was opened after deployment and exposes no analysis-history disclosure or run controls.
