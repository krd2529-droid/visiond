# Customer Data Analysis — Patch Handoff

Updated: 2026-08-10
Build: v0.14.48

## Privacy rule
Use aggregate/minimum-necessary business data. Do not copy names, email, phone, slip contents, tokens, API keys, IP addresses, or other unnecessary PII into patch planning documents.

## Required analysis before every patch
Review, where available:
- Funnel counts/rates: landing/view/signup/cart/checkout/paid.
- Product/course view → cart → paid performance.
- Revenue, orders and average order value.
- New vs returning/repeat behavior when sample size is meaningful.
- UTM source/campaign/creative attributed paid performance.
- Spend, attributed revenue, profit and ROAS.
- Payment failure/abandonment signals.

## Current snapshot
No production D1 customer dataset is bundled in this source ZIP, so this patch cannot truthfully claim a production conversion baseline. v0.14.44 and v0.14.45 provide the instrumentation needed to obtain that baseline after deployment.

### Evidence available from code state
- Customer Intelligence instrumentation: IMPLEMENTED.
- Authoritative backend purchase event: IMPLEMENTED.
- Campaign/creative spend + attribution/ROAS: IMPLEMENTED.
- Production outcome validation: PENDING.

## Current conclusion
Do not invent customer conclusions from source code. Deploy, collect real aggregate events, then use the observed bottleneck to confirm or reorder v0.14.47.

## Patch decision record
v0.14.46 is documentation/protocol infrastructure rather than a conversion change because future J patches need a persistent, privacy-safe handoff and a rule that production data overrides speculative roadmap sequencing.


## Product-family demand analysis — v0.14.47
Always aggregate numbered product series by base title before production decisions. Compare premade stock against demand-driven stock. Never infer demand from inventory count alone. Use view/exposure, cart, checkout, paid orders, revenue, and sample sufficiency. Production recommendations must state PRODUCE / TEST / HOLD and the evidence.


## Guest identity + first-order gift analysis — v0.14.48
Anonymous visitors must be counted by hashed per-browser/device `visitor_key`, never by a shared `guest` label. When the same visitor registers/logs in, link their prior anonymous events to the resulting user ID while retaining the hashed visitor key for continuity.

Required metrics after deploy:
- distinct anonymous visitors
- guest gift impressions/clicks
- guest → signup conversion
- guest → authoritative first-paid conversion
- first-order gift grants
- duplicate-gift attempts (target: 0 successful duplicates)
- revenue excluding system gift orders
- Product Family interest before signup and resulting first purchase/gift category

Do not interpret one browser/device as one human across all devices. The technical identity is intentionally browser/device scoped unless the visitor later authenticates.


## v0.14.49 analysis requirement
The recommendation engine derives interest from the last 30 days of product_view/add_to_cart/checkout_start events. Analyze aggregate recommendation impressions, clicks, cart and paid outcomes by Product Family. No production database is bundled with this patch, so current winner/loser families are UNKNOWN until deployed evidence exists.
