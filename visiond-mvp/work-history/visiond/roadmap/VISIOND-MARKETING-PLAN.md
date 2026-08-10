# VisionD Marketing Plan — Living Growth Plan

Updated: 2026-08-10
Current build: v0.14.48

## Positioning
VisionD is a platform for digital products and online courses, with a creator path for people who want to sell their own course. Keep the storefront message simple: buy digital products, learn online, or create/sell a course.

## Growth operating loop
`Traffic → Product/Course View → Signup → Add Cart → Checkout → Paid → Repeat`

Every patch must inspect available aggregate data, identify the largest credible leak/opportunity, make a measurable change, then compare the post-deploy result against the baseline.

## Current acquisition strategy
- Focus paid/organic campaigns on a small number of Hero Offers instead of advertising the whole catalog at once.
- Keep Buyer, Learner and Creator acquisition funnels separate.
- Use consistent UTM values for source/campaign/creative so Ads Intelligence can match spend to authoritative paid revenue.
- Scale only campaigns/creatives with purchase evidence; do not optimize from clicks alone.

## Creative production
For each Hero Offer, test materially different angles: pain/problem, live demo, outcome, price/value, comparison, FAQ/trust, proof. Record `utm_campaign` and `utm_content` consistently.

## Conversion priorities
1. Paid completion / payment trust and reliability.
2. Product/offer clarity and Add-to-Cart rate.
3. Signup friction where it blocks purchase.
4. Retargeting for high-intent abandoned journeys.
5. Repeat purchase and creator-driven acquisition.

## Promotion policy
First-order promotion is a conversion tool, not the core proposition. Measure incremental paid conversion and margin impact. Avoid expanding discounts when the underlying funnel problem is product relevance, trust, or payment failure.

## Data-driven KPI set
- Visitors / landing sessions
- Product/course views
- Signup completion
- Add-to-cart rate
- Checkout-start rate
- Paid conversion rate
- Revenue and average order value
- Campaign/creative spend, attributed revenue and ROAS
- Repeat buyer behavior when sample size becomes meaningful

## Next marketing actions
- DEPLOY/VALIDATE — v0.14.44–46 and establish baseline funnel + attribution.
- NEXT — identify the highest-value conversion leak and select one primary experiment for v0.14.47.
- NEXT — identify winning/losing campaign + creative combinations from purchase data, not CTR alone.
- HOLD — aggressive ad scaling until attribution and paid conversion are validated in production.

## Rule when plan is completed
J must create the next marketing phase from observed customer and revenue data, explain why priorities changed, and leave the proposal in this file for Boss review/adjustment.


## Digital Product Demand Production Rule — v0.14.47
- Treat same-base-name numbered sets as one Product Family.
- Existing sets made before demand evidence are `premade_stock`; their existence is not proof of popularity.
- Production priority uses observed views/exposure, cart, checkout, paid orders and revenue.
- Low exposure means insufficient evidence, not automatically poor demand.
- Winning families may be extended sequentially with the same base title and next set number; those follow-up products should be marked `demand_driven`.
- Next personalization phase should recommend related families/products to interested visitors and measure incremental purchase lift.


## Guest Acquisition Offer — v0.14.48
Offer: unauthenticated visitors are informed that registering and completing their first paid bill unlocks one digital-product basket for free.

Measurement funnel:
`guest_gift_view → guest_gift_click → signup_complete → checkout_start → authoritative paid → first_order_gift_granted`

Rules:
- Optimize the offer from paid uplift, not signup volume alone.
- Gift issuance is automatic after authoritative paid confirmation; Boss performs no manual unlock/order creation.
- Gift value is zero in revenue reporting.
- Prefer a gift near the visitor/member's observed digital-product interest, but exclude special rights/courses and already-owned products.
- Compare conversion/margin before and after deployment; if signup rises but paid does not, revise the offer instead of expanding giveaways.
- Keep frequency controlled so the guest notice does not become intrusive.

Next marketing work:
- DEPLOY/VALIDATE — measure guest notice impression → click → signup → first paid.
- NEXT — personalize related digital products by Product Family and recent interest.
- NEXT — use aggregate Product Family demand to decide which numbered sets to produce next.


## v0.14.49 Personalized merchandising
- Recommendation surface now uses recent first-party Product Family/category interest for anonymous and signed-in visitors.
- Do not enable aggressive personalized popup frequency until recommendation CTR/cart/paid uplift is observed in production.
- Measure: recommendation_view, recommendation_click, downstream add_to_cart, purchase and revenue.
- Production decision remains family-level: premade stock count is not demand evidence; exposure and paid conversion decide whether to extend the next numbered set.
