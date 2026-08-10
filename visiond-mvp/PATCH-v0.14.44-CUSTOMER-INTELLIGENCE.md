# VisionD v0.14.44 — Customer Intelligence

Base: v0.14.43 first-order promo notification bell.

## Added
- `customer_events` D1 table + migration 0013 with indexed event/user/visitor/product timelines.
- Whitelisted `/api/analytics/event` endpoint. It accepts business events only, strips query strings/referrer queries, bounds text, and only accepts numeric metadata fields.
- First-party anonymous visitor continuity reuses the existing HttpOnly visitor identity; logged-in events attach the server-resolved user ID.
- Session attribution for UTM source/medium/campaign/content and safe referrer path.
- Funnel events: landing/product/course view, add/remove cart, checkout, payment submit/failure, download, course start and selected account lifecycle events.
- Authoritative `purchase` event is written server-side only after `grantOrder` successfully changes an order from pending review to paid.
- Admin Customer Intelligence card: 30-day funnel, paid buyers/orders/revenue, top product view-to-cart engagement, and recent member journeys.

## Preserved
- Existing `page_views`, `analytics_daily`, visitor counters and 90-day analytics retention.
- Existing cart/order/payment, Vision 5, ELON isolation and first-order promotion behavior.

## Security/privacy
- No passwords, tokens, API keys, slip contents, full URLs/query strings, arbitrary JSON, IP addresses or free-form customer text are accepted into customer events.
- User identity is resolved from the server session; the browser cannot submit a user ID.
- Purchase cannot be forged through the public event endpoint.
- Event endpoint is rate limited and duplicate events within 10 seconds are suppressed.
