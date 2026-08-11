# Patch v0.14.174 — Version Display Single Source

Event Case: deployed code advanced while WEB/ADMIN still showed v0.14.169.

- `VERSION.txt` is the release source of truth.
- `npm run release:stamp-assets` stamps both WEB and ADMIN badges from that value.
- v0.14.174 regression test rejects the stale v0.14.169 badge.
- No customer/order/payment data migration in this patch.
