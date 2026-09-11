# Patch v0.20.104 — Boss commission periods and channel scopes

- Keeps the private control dynamic and Boss-only; opening it is request-free and only one `แสดงค่าคอม` action reads data.
- Adds selected-channel and all-owned-active-channel scopes plus completed month, one-day and inclusive-range modes.
- Defaults to the latest completed Bangkok month and enforces the same rolling 90-day/yesterday boundary as Partner order sync.
- Copies a valid resolved range into the existing sold-order state and inputs without triggering provider sync.
- Uses one bounded latest-active owned-channel/exact-coverage query and one indexed Partner-order aggregate query, never N+1 or provider calls.
- Shows grouped grand totals and per-channel scope/sync/unavailable-amount status without treating partial data as complete.
- A channel sync invalidates only that owner's selected-channel cache and the same owner's all-channel cache.
- Keeps the legacy mixed commission workspace disabled and excludes snapshots, collector, referral, card, raw and token paths.
- Focused regression: `npm run test:v020104`.
