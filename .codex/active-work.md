# Active patch: Populate TikTok Marketplace categories

- Status: PATCH_READY
- Outcome: Populate the category dropdown with multiple authoritative categories discovered from TikTok Open Collaboration products.
- Source: Creator Search Open Collaboration Product API; scan up to 100 unfiltered products and deduplicate returned category IDs/names.
- Preserve: user search results, filters, snapshots/growth history, Showcase, OAuth, and channel isolation.
- Acceptance: categories load automatically once per connected Creator account; discovery results do not replace visible search results or write growth snapshots; loading/error states stay usable.
- Likely files: TikTok Shop marketplace endpoint/client, regression tests, visible version files.
- Phase: implementation and focused/regression/pre-deployment checks passed.
- Delivery: test, review diff, commit only related files, push origin main, verify production.
