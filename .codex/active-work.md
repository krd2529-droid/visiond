# Active patch: Configurable TikTok Showcase sync limit

- Status: PATCH_DELIVERED
- Outcome: Let the user choose how many Showcase products to fetch during TikTok Shop refresh, capped at 2,000.
- Preserve: TikTok Shop authentication, order refresh and its existing limit, Marketplace, Showcase add/remove, snapshots, and channel isolation.
- Acceptance: visible numeric control; accepts 1–2,000; selected value reaches the sync API; server and helper enforce the 2,000 cap; completion message reports the actual count.
- Likely files: TikTok analyzer UI/client, TikTok Shop sync API/helper, regression tests, visible version files.
- Phase: committed, pushed to origin/main, and verified on production at v0.20.35.
- Delivery: test, review diff, commit only related files, push origin main, verify production.
