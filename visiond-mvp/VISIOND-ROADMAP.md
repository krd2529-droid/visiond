# VisionD Roadmap — Living Plan

Updated: 2026-08-10
Current build: v0.14.49
Owner protocol: JARVIS / J

## Operating rule
This file is the project handoff source of truth inside every VisionD patch. Before changing code, J must read this roadmap, the marketing plan, the latest patch note, and the available aggregate customer/business data. After each patch, J updates statuses and recommends the next patch from evidence rather than blindly following old sequencing.

Status: `IMPLEMENTED` = code exists, `DEPLOYED` = production deploy confirmed, `VALIDATED` = production data confirms behavior/outcome, `NEXT` = proposed next work, `HOLD` = intentionally deferred.

## North star
Build VisionD into a low-manual-work digital commerce platform where products/courses can be published, sold, paid, delivered, measured, and improved from customer behavior data.

## Phase 1 — Data foundation
- IMPLEMENTED — v0.14.44 Customer Intelligence: first-party events, funnel, journey, authoritative backend purchase.
- IMPLEMENTED — v0.14.45 Ads Intelligence: campaign/creative spend, attribution, revenue/orders/profit/ROAS.
- IMPLEMENTED — v0.14.46 Living Roadmap + Marketing Plan + Customer Data Analysis protocol.
- NEEDS DEPLOY/VALIDATION — verify v0.14.44–46 on production and collect enough real events to establish a baseline.

## Phase 2 — Conversion intelligence
- IMPLEMENTED — v0.14.47: Conversion + Product Demand Intelligence; groups numbered product series into families, distinguishes premade stock from demand-driven production, and recommends PRODUCE / TEST / HOLD from observed views/cart/checkout/paid data.
- NEEDS DEPLOY/VALIDATION — validate family recommendations against production traffic and sales; low exposure must not be treated as low demand.
- Proposed — conversion diagnostics for Product View → Add Cart → Checkout → Paid.
- Proposed — compare new vs returning visitors and first purchase behavior without exposing PII.

## Phase 2B — Guest acquisition
- IMPLEMENTED — v0.14.48: unique anonymous visitor identity per browser/device, guest → member history claim, guest signup/first-bill gift notice, and automatic first-paid-order digital gift with no Boss action.
- NEEDS DEPLOY/VALIDATION — verify separate browsers do not collapse into one guest, measure guest notice → signup → paid uplift, and confirm exactly-one gift idempotency.

## Phase 3 — Personalization + retargeting
- IMPLEMENTED — v0.14.49: privacy-minimized 30-day interest profile + related-product engine for anonymous/member visitors, prioritizing unseen products in the same Product Family then adjacent category products.
- NEEDS DEPLOY/VALIDATION — measure recommendation impression → click → cart → paid uplift before enabling more aggressive personalized popups.
- Proposed — smart related-product/promo surfaces with frequency caps; measure recommendation impression → click → cart → purchase.
- Proposed — production queue should extend winning families sequentially (same base title, next set number) and mark those new sets `demand_driven`.

## Phase 3B — Retargeting segments
- Proposed — v0.14.50: privacy-minimized actionable segments: viewed-not-carted, cart-not-checkout, checkout-not-paid, buyer, repeat buyer.
- Proposed — segment counts and campaign-ready criteria; no raw secret/slip/customer contact data in planning files.

## Phase 4 — Growth experiments
- Proposed — v0.14.51: experiment registry for offer/creative/promo/landing tests with baseline, hypothesis, KPI, start/end and result.
- Proposed — prevent declaring a winner without adequate observed data.

## Phase 5 — Growth Command Center
- Proposed — v0.14.52: combine customer funnel, ads, product performance and experiment outcomes into one decision surface.
- Proposed — generate the next prioritized action from measured bottlenecks.

## Decision gates
1. Production data overrides this proposed order when it reveals a materially larger bottleneck.
2. Security/payment/auth regressions override growth work.
3. A feature is not `VALIDATED` merely because tests/build pass.
4. When this roadmap is completed, J drafts the next phase automatically and clearly marks it proposed for Boss review.

## Event queues
### EVENT CASE
- COMPLETE — establish two-queue patch protocol and rotating roadmap tracks.
- No carried Event Case after v0.14.49.

### EVENT ROADMAP rotation
- IMPLEMENTED — Growth/Data: v0.14.49 Personalized Product Engine.
- NEXT — Commerce/Conversion: diagnose Product View → Cart → Checkout → Paid leakage.
- WAITING — Product/Production: strengthen demand-driven production queue from family exposure and paid evidence.
- WAITING — Course/Creator.
- WAITING — Security/QA.
- WAITING — Marketing: smart promo/retarget after recommendation baseline.

## Current next decision
Deploy v0.14.48–49 and validate guest acquisition plus recommendation behavior. Analyze `recommendation_view → recommendation_click → add_to_cart → purchase`. Unless production data or a new Event Case overrides it, rotate next to Commerce/Conversion diagnostics. Continue Product Family production decisions from exposure/cart/paid evidence, never inventory count alone.
