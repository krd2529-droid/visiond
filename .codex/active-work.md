# Active patch: Separate F from ungraded products

- Status: PATCH_READY
- Report: F and no-grade currently overlap because multiple grading layers automatically turn zero sales or low scores into F while another UI rule says zero sales has no grade.
- Outcome: reserve F for products explicitly discarded or failed by the user; zero sales and insufficient evidence remain ungraded.
- Preserve: Marketplace API, product/shop search modes, filters, results, Showcase actions, and styling.
- Acceptance: automated analysis never creates F from zero sales, low traffic, or score alone; zero orders displays no grade; F remains for explicit discard/manual fail and survives reanalysis; summary prompt uses the same meanings.
- Phase: implementation complete; regression, syntax, mobile frontend, and predeploy checks passed.
- Delivery: ready to commit and push to origin/main.
