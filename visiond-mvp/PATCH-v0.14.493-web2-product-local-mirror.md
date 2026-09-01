# PATCH v0.14.493 — Web2 product local mirror

Web2 can now build and maintain a local product catalog without calling VisionD for every visitor.

- Initial sync: consume `GET /api/partner/v1/products/changes?cursor=0` until `has_more=false`.
- Save `pagination.next_cursor` only after the local database transaction succeeds.
- Incremental sync: repeat from the saved cursor, recommended every 5 minutes.
- `upsert` replaces the local product row and queues public cover/preview assets for mirroring to Web2 storage.
- `delete` removes the local catalog row and its mirrored public assets. It must never revoke an existing paid entitlement.
- Original paid files and R2 object keys are never returned. Checkout, entitlement, claim, and protected download remain authoritative in VisionD.
- The change cursor is monotonic and includes publish, edit, hide, soft-delete, and physical-delete events.

The starter client exposes `productChanges()` and `productChangePages()`.
