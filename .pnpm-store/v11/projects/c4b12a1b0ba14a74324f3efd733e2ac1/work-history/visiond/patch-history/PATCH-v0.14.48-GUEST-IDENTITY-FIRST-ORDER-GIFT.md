# PATCH v0.14.48 — Guest Identity + Automatic First-Order Gift

Updated: 2026-08-10
Base: v0.14.47
Status: IMPLEMENTED — requires production deploy/validation

## Goal
Convert anonymous visitors into members and first-time buyers without manual Boss work, while keeping every guest technically distinct.

## What changed
- Guest identity is a unique `__Host-vd_vid` UUID cookie per browser/device, Secure + HttpOnly + SameSite=Lax.
- The raw UUID is never stored in analytics tables. The server hashes it into `visitor_key`.
- Analytics view is now established before the first business event is sent, preventing the first event from falling into a shared/null guest bucket.
- On registration or successful login, anonymous events for the current visitor key are claimed into that `user_id`.
- Added guest acquisition notice: `สมัครสมาชิก + เปิดบิลแรก รับฟรีสินค้าดิจิทัล 1 ตะกร้า`.
- Added `guest_gift_view` and `guest_gift_click` events.
- When a user's first real paid order is confirmed, backend creates one zero-value `first_order_gift` order automatically and grants entitlement.
- Unique DB index enforces one first-order gift per user.
- Gift orders use `order_origin='first_order_gift'`, `gift_for_order_id=<source paid order>`, total 0, and do not become revenue.
- Gift selection prefers digital products related to recent customer interest, excludes resale-rights/online courses, excludes already-owned/paid products, and uses a default maximum listed price of 199 THB (`first_order_gift_max_price=19900` can override).
- Member notification bell labels the system gift as a free first-order gift.
- Customer Intelligence reports distinct anonymous visitors vs identified members; no names/emails are added for anonymous guests.

## Abuse / safety rules
- A checkout alone never grants the gift. The source order must become authoritative `paid`.
- One gift per user is enforced server-side and by a unique partial index.
- Gift creation is idempotent; repeated approval attempts cannot issue multiple gifts.
- Guest separation never uses the literal `guest` as a customer identity.
- Raw guest UUID and customer PII are not written into roadmap/marketing analytics.

## Production validation required
1. Two separate browsers/devices produce two different anonymous visitor keys.
2. Same browser returns with the same visitor key while cookie is retained.
3. Register after product browsing: prior anonymous events become associated with the new user.
4. First verified paid order produces exactly one gift order + entitlement.
5. Second paid order produces no additional gift.
6. Gift order total remains zero and is excluded from revenue/paid-source-order logic.
7. Guest notice impressions/clicks appear in Customer Intelligence.

## Next proposed patch
v0.14.49 — Personalized Product Engine: use recent product-family interest for related product surfaces and measure recommendation impression → click → cart → purchase. Production data may reorder this if a larger bottleneck appears.
