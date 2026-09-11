# Patch v0.20.103 — Boss Partner commission test

- Adds one post-auth Boss-only `ดูค่าคอม (Boss Test)` action beside channel product management.
- Adds a private read-only endpoint that accepts only Boss and aggregates the selected owned channel's bounded, indexed Partner order-sync rows.
- Reports exact-range Partner order-sync state and warns when the selected range is not completely synced.
- Keeps the legacy commission workspace disabled and excludes commission-center snapshots, collector status, referrals, cards and provider calls.
- Treats zero or non-strict/localized stored amounts as unavailable instead of showing a fabricated zero.
- Deduplicates same-key requests, caches for 30 seconds, invalidates only the synced owner/channel and suppresses stale owner/channel/range/revision responses.
- Focused regression: `npm run test:v020103`.
