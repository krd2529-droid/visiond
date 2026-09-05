# Active patch: Fill missing Showcase product images

- Status: PATCH_DELIVERED
- Requested outcome: show a real product image in the Showcase table whenever TikTok supplied one through either Showcase or order product data.
- Root cause: order product details already carry fallback images, but `renderShowcaseProducts` does not merge them into Showcase rows whose `image_url` is empty.
- Add: merge same-channel order product details into Showcase rows by exact Product ID, filling only missing name/image fields.
- Preserve: existing Showcase image priority, ordering, grades, metrics, pagination, delete actions, and one-card-one-channel isolation.
- Acceptance: a Showcase product with no Showcase image but a matching order image renders the order image; existing Showcase images are never replaced; other product IDs cannot leak images.
- Likely files: analyzer client and focused regression test.
- Phase: implementation complete; verification and delivery in progress.
- Verification: Showcase order-image fallback PASS; sold-product name resolution PASS; dynamic columns PASS; Creator readiness PASS; one-card-one-channel isolation PASS; syntax and diff checks PASS.
- Delivery: implementation committed as `617951d0` and pushed to `origin main`.
