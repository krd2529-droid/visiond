# Active patch: Marketplace creator density

- Status: PATCH_DELIVERED
- Report: Marketplace results do not expose TikTok creator participation counts.
- Outcome: show the API-provided content creator and Showcase creator counts as creator density in each Marketplace row.
- Preserve: search, filters, snapshots, growth, selection, and Showcase add behavior.
- Data rule: use only TikTok response fields; never infer missing creator counts.
- Acceptance: API normalization preserves both counts, the Marketplace table labels and renders them, missing values remain explicit, regression/mobile/predeploy checks pass.
- Phase: implemented, tested, pushed, and verified on production.
- Verification: creator-density normalization PASS; Marketplace adversarial PASS; supported columns PASS; horizontal selector PASS; mobile frontend PASS; predeploy PASS (8 checks, 9 existing environment warnings); diff check clean.
- Delivery: `e552e752` on `origin/main`; production serves JS cache key `02059` with the creator-density column.
