# VisionD Marketing Plan — Living Growth Plan

Updated: 2026-08-11
Current build: v0.14.162

## v0.14.162 LINE activation gate
- Require a successful LINE Verify before enabling Use webhook and testing one real message.

## v0.14.161 V-Learning and LINE continuity
- Keep both the sample V5 conversion gate and LINE OA verify path in the same production baseline before sending more campaign traffic.

## v0.14.159 bounded production proof
- Keep the sample conversion gate responsive and visibly fail closed before expanding V-Learning ads.

## v0.14.158 focused sample proof
- Validate only the sample V5 conversion before campaign expansion.

## v0.14.157 reliable conversion proof
- Make the production conversion audit responsive before accepting the sample funnel as campaign evidence.

## v0.14.156 production conversion proof
- Require one complete sample conversion with paid order, slip evidence and learner entitlement before scaling the V-Learning campaign.

## v0.14.155 sample-basket conversion verification
- Unblock the Boss-reviewed test purchase so the advertised V-Learning path can be verified through learner access before further ad expansion.

## v0.14.154 V5 Event Case protection
- Preserve `user1` and the sample basket while validating the live V5 acquisition-to-learning path.
- Treat production verification as the gate before any new campaign feature work.

## v0.14.153 zero-friction production patches
- Use overlay-only releases during active V5 acquisition: no deletion scripts, folder moves, or Cloudflare changes.
- Treat `visiond-mvp` as the only production target and verify its immutable Pages URL after each push.

## v0.14.152 stable V5 production path
- Keep `visiond-mvp` as the permanent Cloudflare production root throughout active V5 acquisition.
- Cleanup must never change the production path; remove only verified obsolete files outside the active tree.

## v0.14.151 V5 campaign continuity
- Keep the currently configured Cloudflare tree live while synchronizing it to the approved release.
- Verify the immutable Pages deployment shows 151 before relying on the custom domain during active V5 ads.

## v0.14.150 creator operations reliability
- Keep manual-approval orders beside customer revenue so creators can act without searching another section.
- Prevent deploy-version ambiguity by verifying the immutable Pages URL before sending traffic to production.

## v0.14.149 creator workflow clarity
- Keep the three-step onboarding guide distinct from the six operational workspace parts.
- Put paid-order totals beside the customer sales table so creators evaluate revenue in context.

## v0.14.148 course presentation
- Standardize seller upload previews and course detail covers to the same portrait frame as catalog cards.
- Preserve published seller courses in the owner center so creators can continue editing lessons and monitoring sales.

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
# v0.14.135 — Header Trust/Conversion Guard

- ปุ่มเข้าสู่ระบบ สมัครสมาชิก รถเข็น และบัญชีต้องมีอย่างละหนึ่ง เพื่อไม่ให้ผู้ซื้อสับสนก่อนเริ่ม checkout
- เก็บ funnel เดิม `view → add-to-cart → checkout → purchase` โดยแพตนี้ไม่เพิ่ม event ซ้ำและไม่เปลี่ยนข้อมูลลูกค้า
- หลัง deploy ตรวจหน้าแรกทั้ง Guest/Member/Boss ภาษา TH/EN ก่อนยิงแคมเปญ เพื่อยืนยันว่าปุ่ม conversion ไม่ซ้ำ
# v0.14.136 — Release Visibility

- เลขเวอร์ชันที่มองเห็นช่วยให้ Boss ยืนยัน release ก่อนตรวจ funnel หรือเริ่มแคมเปญ
- เวอร์ชันไม่มี PII และไม่เพิ่ม analytics event จึงไม่ทำให้ตัวเลข view → purchase ซ้ำ
# v0.14.137 — Seller Activation Friction Reduction

- ลดจุดหลุดของเจ้าของคอร์สระหว่างตั้งค่ารับเงิน → เผยแพร่ โดยไม่เพิ่มขั้นรออนุมัติบัญชี
- ไม่เปลี่ยน event funnel และไม่ส่งข้อมูลชื่อบัญชีเข้า analytics
- หลัง deploy ติดตามอัตรา `course draft → publish → approved` เทียบก่อนแพต
# v0.14.138 — Daily Event Insight

- หลังบ้านดูพฤติกรรมรายวันเพื่อค้นหาจุดที่ลูกค้าหยุดหรือปุ่มที่ถูกใช้งานจริง
- แยกหน้าร้าน คอร์ส VBot และหลังบ้าน เพื่อใช้ปรับ UX โดยไม่เก็บข้อความหรือข้อมูลลับที่ผู้ใช้กรอก
# v0.14.142 — Course Supply Review Reliability

- ลดเวลารอตรวจคอร์สโดยเปิดขายเฉพาะรายการที่ผ่านเงื่อนไขชัดเจน
- รายการไม่พร้อมถูกส่งกลับแก้ไขพร้อมเหตุผล ไม่ถูกเปิดขายผิดและไม่วนตรวจซ้ำ
- หลัง deploy ติดตามจำนวน pending → approved และ changes_requested โดยไม่เพิ่มการเก็บ PII

# v0.14.141 — Consistent Catalog Cards

- ทำให้คอร์สและสินค้าดิจิทัลมีภาษาภาพเดียวกัน ลดความลังเลเมื่อผู้ซื้อเลื่อนดูหน้าแรก
- คอร์สใช้ภาพปกเดียวและ action เดียวเพื่อให้เส้นทาง `course view → checkout` ชัดเจน
- ไม่เพิ่ม event หรือการเก็บ PII; ประเมินผลจาก click และ purchase เดิม

# v0.14.140 — Cleaner Course Discovery

- หน้าแรกให้ผู้ซื้อค้นหาคอร์สจากชื่อ ผู้สอน และแพลตฟอร์มได้ในพื้นที่ V-Learning เดียว
- ลดปุ่มทางเลือกที่ซ้ำกันเพื่อให้เส้นทางหลักชัด: ดูคอร์สและสั่งซื้อ หรือเข้าเรียน
- แยกคอร์สออกจากหมวดค้นหาสินค้าดิจิทัล เพื่อไม่ให้ผู้ซื้อสับสนระหว่างสินค้าไฟล์และบทเรียน

# v0.14.139 — Course Discovery on Home

- เพิ่มเส้นทางค้นพบคอร์สจากหน้าแรกไปยังรายละเอียดและ Checkout โดยตรง
- ใช้เฉพาะคอร์สที่เปิดขายจริง ลดความสับสนระหว่างสิทธิ์สร้างคอร์สกับคอร์สสำหรับผู้เรียน
- วัดผลผ่านเหตุการณ์ `course_view`, `ui_click`, `add_to_cart`, `checkout_start` และยอดซื้อจริงในศูนย์เหตุการณ์หลังบ้าน
# v0.14.145 — V-Learning Link Preview

- ใช้ภาพพรีวิว V-Learning เป็นภาพหลักเมื่อแชร์หน้าแรกผ่าน Facebook, LINE และ Messenger
- ข้อความสื่อสารหลัก: ระบบคอร์สออนไลน์ จ่ายครั้งเดียว รับยอดขายเต็ม ไม่หักเปอร์เซ็นต์
- CTA หลังผู้ชมเปิดลิงก์พาไปดูคอร์สที่เปิดเรียน โดยยังคงสินค้าดิจิทัลเป็นสินค้ารองในหน้าเดียวกัน

# v0.14.146 — Course Seller Funnel Visibility

- เรียงศูนย์จัดการคอร์สตาม funnel เดียว: ดูยอด → ตั้งค่ารับเงิน/ตรวจสลิป → สร้างและเผยแพร่ → ดูลูกค้าและยอดรวม
- ทำให้เจ้าของคอร์สเห็นออเดอร์รออนุมัติก่อนเริ่มงานสร้างคอร์ส ลดการพลาดสลิปที่ต้องตรวจเอง
- ใช้ข้อมูลยอดขายและสถานะเดิม ไม่เพิ่มการเก็บอีเมล เบอร์โทร ข้อมูลบัญชี หรือข้อมูลลับใน analytics

# v0.14.147 — Consistent Course Merchandising

- ทำให้ภาพปกคอร์สและสินค้าดิจิทัลมีพื้นที่นำเสนอเท่ากัน ลดความรู้สึกว่าคอร์สเป็นการ์ดรองหรือรูปถูกย่อผิดสัดส่วน
- คงเส้นทาง `course view → checkout → purchase` และ event เดิมทั้งหมด ไม่เพิ่มการเก็บข้อมูลลูกค้า
