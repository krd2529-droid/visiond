# VisionD Marketing Plan — Living Growth Plan

Updated: 2026-08-15
Current build: v0.14.185

## v0.14.184 historical handoff
- Keep technical, product, production and marketing history continuous so future decisions use the real baseline.
- Mark v0.14.180 as reverted; never interpret that failed rollout as a conversion experiment.

## v0.14.183 storefront operations clarity
- Keep mobile navigation unobstructed and separate published inventory from drafts in Boss operations.

## v0.14.182 authoritative sellable inventory
- Category and storefront counts must represent published sellable products, not drafts or deleted inventory.

## v0.14.181 production identity recovery
- Prefer minimal visible-version patches and verify the live page before campaign traffic.

## v0.14.180 failed rollout (REVERTED)
- Full-tree sync caused a blank storefront and was rolled back; it produced no valid marketing baseline.

## v0.14.179 release confidence
- Visible patch identity, Windows QA and the locked Production tree are campaign safety gates.

## v0.14.174–v0.14.178 creator monetization
- Three seller plans, central payment routing, Partner revenue sharing and per-course payout visibility form the creator-growth foundation.
- Scale Partner acquisition only after real order, slip and payout E2E verification.

## v0.14.172–v0.14.173 digital-product merchandising
- Bundle creation and authoritative published counts support offer testing without treating draft inventory as demand.

## v0.14.170–v0.14.171 baseline consolidation
- Preserve product-form behavior and treat large legacy cleanup as infrastructure history, not conversion evidence.

## v0.14.163–v0.14.169 LINE sales readiness
- Progressed from verified connection and diagnostics to a secure human-handoff inbox and grounded consultative product sales.
- Promote LINE as a sales channel only after real-message and order-path validation.



## v0.14.165 activation consistency
- Preserve verified LINE state across app restarts without re-entering secrets.

## v0.14.164 LINE reliability gate
- Require diagnosable AI and webhook readiness before LINE promotion.

## v0.14.163 LINE sales gate
- Validate one grounded LINE AI reply before using LINE as a promoted sales channel.

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
- v0.14.170 rebuilt sales quality: use factual product strengths, baht pricing, and contextual follow-ups to improve qualified purchase intent without premature checkout claims.
# โปรยกชุด (v0.14.172)

- ใช้หมวด `bundle-deals` เป็นหน้ารวมข้อเสนอราคาพิเศษแบบ 10/20/30/50 ตะกร้า
- ชื่อสินค้าควรระบุหมวด จำนวนตะกร้า และลำดับชุด เช่น “รวมแบบรอยสัก 30 ตะกร้า ชุดที่ 1”
- รายละเอียดแสดงรายชื่อตะกร้าและจำนวนรูป เพื่อให้ลูกค้าเห็นมูลค่าที่ได้รับก่อนซื้อ
# ความพร้อมหน้าร้าน (v0.14.173)

- แยกแท็บ “โปรยกชุด” บนแคตตาล็อกเพื่อพาลูกค้าเข้าข้อเสนอรวมโดยตรง
- จำนวนสินค้าบนแท็บต้องยึดการ์ดที่แสดงจริง และแจ้งระบบเมื่อไม่ตรงกับ API
# Vision 5 สามทางเลือก (v0.14.174)

- สื่อสารเป็นบันได: เริ่มฟรี → รับเงินเต็มด้วยสิทธิ์ → ให้ VisionD ดูแลผ่านพาร์ตเนอร์
- ระบุค่า API ให้โปร่งใส: แบบ 1 ผู้ซื้อจ่าย, แบบ 2 ไม่มี, แบบ 3 แบ่งยอด 50/50 ก่อน แล้วหักค่า VisionD API 1 บาทจากส่วนผู้สอน
- ใช้ภาพเปรียบเทียบสามแผนบนหน้าผู้สอนเพื่อช่วยตัดสินใจก่อนสร้างคอร์ส
# ความโปร่งใสพาร์ตเนอร์ (v0.14.175)

- แสดงยอดเต็ม ค่าตรวจสลิป 1 บาท ยอดสุทธิ และส่วนแบ่งทั้งสองฝ่ายแยกรายออเดอร์
- ผู้สอนตรวจยอดรอรับและประวัติจ่ายแล้วได้จากหน้าของตนเอง

# สูตรรายได้พาร์ตเนอร์ (v0.14.177)

- สื่อสารด้วยตัวอย่างตรงไปตรงมา: ยอดขาย 100 บาท → VisionD 51 บาท / ผู้สอน 49 บาท
- แยกคำว่า “ส่วนแบ่ง VisionD 50%” และ “ค่า VisionD API 1 บาท” เพื่อไม่ทำให้ผู้สอนเข้าใจว่าแบ่งหลังหักค่าบริการ

# ความโปร่งใสรายตะกร้า (v0.14.178)

- ให้ทีมหลังบ้านตรวจรายได้ของพาร์ตเนอร์แต่ละตะกร้าได้ทันที ลดข้อโต้แย้งเรื่องยอดแบ่งและค่า API
- ใช้รายงานรายตะกร้าเป็นหลักฐานประกอบการจ่ายผู้สอนและตอบคำถามเจ้าของคอร์ส

# ความน่าเชื่อถือของรุ่นที่เผยแพร่ (v0.14.179)

- แสดงเลขแพตเดียวกันบนหน้าเว็บหลัก Dashboard และหลังบ้าน เพื่อให้ตรวจรุ่น production ได้ชัดเจน
- ใช้ cache stamp ของแพตปัจจุบันกับ asset ที่แก้ ลดความสับสนจากไฟล์เก่าค้างในเบราว์เซอร์
