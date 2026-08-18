# PATCH v0.14.49 — Personalized Product Engine + Event Queue Protocol

## Event Case (priority)
Implemented the Boss-requested two-queue operating model in project handoff files:
- EVENT CASE = ad-hoc Boss work, always first.
- EVENT ROADMAP = planned work, filled only after Event Case is safely complete.
- Large Event Cases must explicitly continue in the next patch and cannot silently accumulate.
- Roadmap tracks rotate so Growth, Commerce, Production, Course, Security/QA and Marketing all continue to receive development.

## Event Roadmap
Implemented the first Personalized Product Engine:
- derives a 30-day privacy-minimized interest profile from product_view / add_to_cart / checkout_start;
- supports both hashed anonymous visitor identity and authenticated user history;
- groups numbered series by Product Family;
- prioritizes unseen products in the same family, then adjacent products in the same category;
- excludes already-owned products for signed-in users and excludes course/resale-right products;
- renders a related-products surface on digital catalog/product pages;
- tracks recommendation_view and recommendation_click with a session frequency cap;
- does not create a permanent PII interest-profile table.

## Data / validation
No production D1 dataset is bundled in this ZIP, so no claim is made about which family currently wins. Production validation must measure recommendation impression → click → cart → paid and compare uplift before adding aggressive popups.

## Next
Event Case queue: none carried over.
Event Roadmap rotation: Commerce/Conversion diagnostics next, unless production data shows a more urgent security/payment issue. Smart popup remains later; recommendation data should be validated first.
