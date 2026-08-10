# Customer Data Analysis — Patch Handoff

Updated: 2026-08-10
Build: v0.14.46

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
