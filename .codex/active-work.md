# Active patch: Remove unsupported Marketplace columns

- Status: PATCH_READY
- Report: Marketplace displays Price and New Product columns even when TikTok does not provide reliable values, leaving misleading empty cells.
- Outcome: remove the two unsupported display columns and correctly size empty-result rows.
- Preserve: price range filters sent to TikTok, product selection, shop, sales, commission, growth, pagination, and Showcase add flow.
- Acceptance: Marketplace renderer contains neither column/cell; empty-state colspan is six; focused Marketplace, mobile, and predeploy checks pass.
- Phase: implementation and supported-column, Marketplace UI/adversarial, responsive, syntax, mobile, and predeploy checks pass; commit/push and production verification in progress.
- Delivery: pending.
