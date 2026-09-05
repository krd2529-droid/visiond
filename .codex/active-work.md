# Active patch: Rename product ranking list

- Status: PATCH_DELIVERED
- Outcome: rename the visible heading `Ranking สินค้า 40 รายการ` to `ลิสคัดสินค้าของฉัน`.
- Preserve: ranking rules, grades, product data, and table behavior.
- Acceptance: old heading is absent, new heading is visible, visible version parity passes, production serves the new heading.
- Phase: rename, regression, visible-version, predeploy, push, and production verification complete.
- Delivery: commit `60106414`, production verified on 2026-09-05; visible build remains `v0.20.49` because this is a text-only correction.
