# VisionD Roadmap — Living Plan

Updated: 2026-08-11
Current build: v0.14.133
Owner protocol: JARVIS / J

## Patch Capacity / Quality Gate (บังคับตั้งแต่ v0.14.55)

- ก่อนเริ่มแพตทุกครั้ง J ต้องประกาศให้ Boss ชัดเจนว่าแพตนั้นต้องใช้ไฟล์ต้นทาง `1 ไฟล์` หรือ `2 ไฟล์` พร้อมระบุชื่อไฟล์ที่ต้องการครบถ้วน แล้วรอ Boss ยืนยัน/ส่งไฟล์ก่อนเริ่มแก้ ห้ามเดาจากไฟล์เก่าเอง ยกเว้น Boss ระบุชัดว่าทีมมีไฟล์ล่าสุดแล้วและอนุญาตให้ต่อแพตได้ทันที
- งาน B1 ส่งมอบให้ Boss เพียง 2 ไฟล์: VisionD Web ZIP และ V Easy APK; Source มือถือเก็บ Private แบบ versioned ภายในทีมเพื่อ build/recheck และห้ามใช้การแกะ APK เป็น Source
- รับคำสั่งเข้า Event Case และ Requirement Ledger ได้ไม่จำกัด แต่งานผลิตต่อแพตต้องจำกัด
- หนึ่งแพตทำหนึ่งระบบหลัก งานปกติ 3–7 งานย่อยแบบ atomic
- แพตเสี่ยงสูงที่แตะเงิน สิทธิ์ ความปลอดภัย ฐานข้อมูล หรือ API ภายนอก ทำ 1–3 งานย่อย
- งานที่เกินกำลังแพตต้องอยู่เป็นรหัส `PENDING` ห้ามหายหรือรวมเป็นหัวข้อกว้าง
- หลังแพตฟีเจอร์ใหญ่ต้องมีแพต QA-only แยก และห้ามผสม Event Roadmap ฟีเจอร์ใหม่ในแพต QA-only
- ก่อนเริ่มและก่อนส่ง ZIP ต้องรัน Source-to-Ledger Recheck เทียบคำสั่งต้นทางทุกข้อกับ Requirement Ledger

Current QA-only patch: `v0.14.55` — Webhook hardening, Source-to-Ledger coverage และ regression repair โดยไม่เพิ่มฟีเจอร์ใหม่

`v0.14.56 IMPLEMENTED` — Vision 7 Release Delivery: ผู้ดูแลอัปโหลดตัวติดตั้งพร้อมเวอร์ชัน/บังคับอัปเดต/SHA-256 และลูกค้าที่มีสิทธิ์ active หรือ trial ดาวน์โหลดจากบัญชีตนเองได้

`v0.14.57 IMPLEMENTED` — Vision 7 Operator Control: ออกคีย์จากผู้ใช้/โปรแกรม/แพ็กเกจ, ต่ออายุจากวันหมดอายุเดิม, ระงับ/เปิดคืน และดู Audit History กับอุปกรณ์ของคีย์

`v0.14.58 IMPLEMENTED` — PAGE_SALES Grounded AI: รับงานจาก Meta แบบ async, ตอบจากแคตตาล็อก/ราคาโปรโมชันจริง, ตรวจ slug และราคาหลัง AI ตอบ, บล็อกข้อมูลส่วนตัว/Secret/ลิงก์ และส่งผ่าน outbox ที่ retry ได้

`v0.14.59 IMPLEMENTED` — Production Meta Ads API: ซิงก์ Insight รายวันระดับโฆษณาและประกบ Campaign / Ad Set / Ad / Creative, upsert กันข้อมูลซ้ำ, เก็บสถานะรอบซิงก์ และแสดง Spend / Impression / Click / CTR / ROAS ใน Ads Center โดยไม่แก้ไขโฆษณา

`v0.14.62 IMPLEMENTED` — Large Bugfix: เก็บเอกสารรุ่นเก่าที่ต่างจาก archive ไว้กู้คืน, บังคับเพดานเครื่อง Vision 7 แบบ atomic, reclaim Meta Webhook ที่ค้าง, นำ Account renderer เก่าที่ไม่ใช้และเสี่ยง injection ออก และตรวจ Patch Ledger ต่อเนื่องทุกเวอร์ชัน

`v0.14.63 IMPLEMENTED` — Vision 7 Key Center: เปิดทางเข้าจาก Admin, ตรวจ Secret, แสดงสรุปและยืนยันก่อนออกคีย์, รองรับโปรแกรม V Easy และเตรียมสถานะ `unbound` รอผูกร้านจริงในแพตถัดไป

`v0.14.64 IMPLEMENTED` — Account + Key Ownership: โปรแกรมล็อกอินบัญชี VisionD, App Session Token เก็บแบบ hash, ผูก Session กับเครื่อง และ Activation ตรวจคีย์ว่าเป็นของบัญชีเดียวกัน

`v0.14.65 IMPLEMENTED` — ผูก V Easy 1 คีย์ต่อ 1 ร้าน พร้อมตรวจเจ้าของภายใน Account + License + Shop + Facebook Page ID และกันคีย์/Page ซ้ำด้วย Unique Constraint

`v0.14.66 IMPLEMENTED` — Runtime/Chat Lock, message/order idempotency และ account-switch isolation; Event Case ฝั่ง VisionD พร้อมตรวจปิด

`v0.14.67 QA HARDENED` — เพิ่มทะเบียน Conversation แยกร้าน เก็บ participant แบบ hash และห้ามออก Conversation Lease ให้รหัสแชทที่ไม่ได้อยู่ในร้าน

`v0.14.68 WORK-DROP RECOVERY` — แก้ปุ่ม Vision 7 ที่หลุดจาก Admin จริง พร้อมเปลี่ยนหลักฐานและเทสต์ให้ตรวจทางเข้าหลังบ้านแทนการตรวจเฉพาะหน้าปลายทาง

`v0.14.64 NEXT EVENT CASE` — V Easy Account + Key Ownership: บังคับล็อกอิน VisionD, session owner ต้องตรงกับเจ้าของคีย์ และเตรียม session/device token ที่เพิกถอนได้

## Operating rule
This file is the project handoff source of truth inside every VisionD patch. Before changing code, J must read this roadmap, the marketing plan, the latest patch note, and the available aggregate customer/business data. After each patch, J updates statuses and recommends the next patch from evidence rather than blindly following old sequencing.

Status: `IMPLEMENTED` = code exists, `DEPLOYED` = production deploy confirmed, `VALIDATED` = production data confirms behavior/outcome, `NEXT` = proposed next work, `HOLD` = intentionally deferred.

## North star
Build VisionD into a low-manual-work digital commerce platform where products/courses can be published, sold, paid, delivered, measured, and improved from customer behavior data.

## Permanent VBot Marketplace Roadmap

1. IMPLEMENTED v0.14.108 / DOWNLOAD POLICY SUPERSEDED v0.14.109 — Free app draft foundation: one multipart form creates app identity, cover, first installer release and three duration plans. Creation consumes no rights or credits. The earlier public-free-download decision was removed by Boss: installer access now unlocks only with an approved owned key purchase.
2. IMPLEMENTED v0.14.109 — VBot one-level storefront: canonical nav is `VBot`; bots.html shows app listing/detail and paid key baskets backed by real `vbot-key` / `vision7-key` products. Only positive active offers publish; NULL/zero/draft stay hidden. Approved purchase unlocks both the owned license key and installer download; pre-purchase access is forbidden.
3. NEXT — Paid entitlement: a paid order grants the matching customer download and issues exactly one key per purchased quantity, idempotently.
4. NEXT — Key ledger: keep test keys and customer keys visibly separate while all issued keys remain auditable in the existing Vision 7 ledger.
5. NEXT — Marketplace QA: test duplicate submit, partial D1/R2 failure, missing/unsupported files, stale release, expired/suspended key, refund/revoke policy, cross-account access and Android/mobile flow.

Compatibility rule: extend the existing Vision 7 Program → Plan → Release → License chain. Do not create a parallel VBot key engine and do not repurpose `vision7_plans.price`; marketplace selling price is the nullable `offer_price` field.

## Permanent UI Theme & Design System Roadmap — Modern AI Commerce

- IMPLEMENTED — v0.14.128 Vision 5 Three-step Auto-EP Flow: ลดเส้นทางเจ้าของคอร์สเหลือ ซื้อสิทธิ์ → ตั้งค่ารับเงิน/ตรวจสลิป → สร้างคอร์ส/เพิ่ม EP/เผยแพร่; ตะกร้าเริ่ม 1 EP และนับ EP จริงอัตโนมัติ ไม่มีช่องกำหนดจำนวนล่วงหน้า พร้อมลิงก์ EasySlip ทางการ

- IMPLEMENTED — v0.14.127 Vision 5 Seller UI + Test User Management: สวิตช์ตรวจสลิปแบบเปิด–ปิด, Preview ปก, การ์ดตะกร้า responsive, EP progressive workspace, ตัดช่องระดับผู้เรียน, หลังบ้านเลือกยูสเทสและแก้ข้อมูลสมาชิกทั้งแถวแบบ Boss-only พร้อม Audit; ยูสเทสเป็นประเภท User ของระบบเว็บและไม่ใช่ Vision 5 test flag
- IMPLEMENTED — v0.14.126 Vision 5 Navigation + Wording Cleanup: หน้า Vision 5 ใช้คำมาตรฐาน `ตะกร้าคอร์ส` / `ตะกร้าคอร์สของฉัน`, การ์ดใช้ปุ่ม `จัดการบทเรียนและ EP`, `แก้ไขตะกร้า`, `ส่งตรวจ`, และโหลด Header/Design assets ด้วย release cache identity เดียวกัน; ห้ามนำคำ `ร่างตะกร้า` หรือ asset key เก่ากลับมาในหน้าผู้ใช้
- IMPLEMENTED — v0.14.119 Canonical Primary Navigation + Platform Policies: หน้าแรก สินค้าดิจิทัล V-Learning และ VBot ใช้เมนูหลักและ Header กลางชุดเดียว, active state ตามหน้าจริง, cache identity ใหม่ และ Privacy/Terms ครอบคลุม LINE, Meta/Facebook, Webhook, API, AI, Secret/Token และข้อห้ามใช้ UI automation/session interception.
- IMPLEMENTED — v0.14.120 Webhook Hub Foundation: หลังบ้านออกลิงก์สุ่มแบบไม่เปิดเผย slug ร้าน, คัดลอก/พัก/เปิด/หมุน URL/ยกเลิก, แยกร้านและ Provider, เก็บประวัติแบบไม่เก็บ payload ดิบ และ fail-closed จนกว่าจะติดตั้ง adapter ตรวจลายเซ็นอย่างเป็นทางการ.
- IMPLEMENTED — v0.14.121 B1 LINE Official Adapter: บันทึก Secret/Token แบบ AES-GCM บนเซิร์ฟเวอร์, ทดสอบ Token กับ LINE Bot Info, ตรวจ X-Line-Signature จาก raw body, กัน webhookEventId ซ้ำ และตั้งค่า/คัดลอก Webhook URL จาก V Easy v1.0.18.
- NEXT — รับข้อความ LINE เข้ากล่องแชต V Easy, queue งานตอบกลับ, บอทนักขายและ handoff เจ้าของร้าน โดยทดสอบตามข้อจำกัด Messaging API จริง.

Direction approved by Boss: use a professional AI-commerce visual language based on commerce-first clarity similar to Shopify Polaris, soft tonal surfaces similar to Material 3, and VisionD's own Tiffany identity. Do not mix unrelated template styles or overuse glassmorphism.

### Brand rules
- Core identity: AI Midnight `#062F2D`, Tiffany Primary `#0ABAB5`, Tiffany Hover `#078E89`, Tiffany Glow `#5FE0DA`.
- Neutral surfaces: Page `#F4FAF9`, Card `#FFFFFF`, Border `#CFE3E1`, Main text `#102F2D`, Secondary text `#607674`.
- Gold is reserved for promotion/money-making emphasis; red is reserved for danger/error; LINE and Facebook colors are reserved for their own contact buttons.
- Storefront product actions must use white surfaces, Tiffany borders and AI Midnight text. Solid black or black-looking product buttons are forbidden; AI Midnight solid fill is reserved for clearly dominant primary actions only.
- Gradients belong only on hero, primary AI actions and explicitly approved promotional surfaces. Ordinary cards use clean surfaces, thin borders and light shadows.
- Preserve VisionD's original Tiffany-to-white page background gradient. UI adoption may modernize components but must not replace the approved legacy page gradient with a flat page color or a dark full-page background.
- Storefront top navigation must use one shared Thai font, weight, size and spacing across pages. Keep “สร้างตะกร้าคอร์ส” immediately after “สินค้าดิจิทัล” and route it to the Vision 5 seller flow. Desktop uses a canonical two-tier header: brand plus account utilities on top, then a centered full-width primary menu below. Header layout must not depend on `:has()`, nested layout wrappers, stale asset keys or runtime injected button CSS.

### Component limits
- Buttons: AI Primary, Secondary, Tonal, Text, Promotion, Danger — only 6 semantic families.
- Button sizes: Large, Standard, Small. Critical mobile actions must be at least 44px high.
- Cards: AI Hero, Feature, Product, Information, Status — only 5 semantic families.
- Every component must share tokenized hover, active, focus, selected and disabled states.
- New pages must reuse the system. Creating one-off button colors, radii or card shadows is forbidden unless Boss approves a named exception.

### Delivery sequence — expected 8 patches, safety ceiling 9
1. IMPLEMENTED v0.14.89 — Design foundation: `visiond-design-system.css`, semantic color/spacing/type/radius/shadow tokens, six buttons and five cards.
2. IMPLEMENTED v0.14.90 — Storefront home: Hero, Vision 5 rights, V-Learning, recommended products, categories and contact adopt the shared system while preserving commerce hooks.
3. IMPLEMENTED v0.14.91 — Purchase journey: catalog, product detail, cart, checkout, payment and slip upload adopt shared UI while preserving commerce contracts.
4. IMPLEMENTED v0.14.93 / CORRECTED v0.14.94 — Member journey: login, registration, dashboard, purchased files and downloads adopt the shared system; bundle promotion remains an animated four-frame GIF and must keep looping.
5. IMPLEMENTED v0.14.95 — Course journey: courses, Vision 5 seller, course baskets, lessons and learner progress adopt the shared components while preserving the original Tiffany page gradient.
6. IMPLEMENTED v0.14.96 / HOTFIXED v0.14.97 — Product systems complete; the homepage and cart now both load the approved animated four-frame looping bundle GIF instead of the stale static banner.
7. NEXT — Operations: Admin, reports, products, members, orders, payment, ELON and Danger Zone.
8. Full UI QA — desktop, Android and iPhone; contrast, focus, overflow, stale CSS and full regression.
9. Conditional stabilization only — use only if legacy CSS collisions or production validation reveal defects; no new visual features.

### Release gates
- Visual identity is clearly changed after patch 2.
- Customer purchase flow is ready for production validation after patch 3.
- The roadmap is complete only after patch 8 passes full UI QA; patch 9 is contingency, not automatic scope.
- Event Case still has priority. When an urgent Event Case interrupts this roadmap, resume from the first unfinished UI patch without skipping its verification gate.

## Phase 1 — Data foundation
- IMPLEMENTED — v0.14.44 Customer Intelligence: first-party events, funnel, journey, authoritative backend purchase.
- IMPLEMENTED — v0.14.45 Ads Intelligence: campaign/creative spend, attribution, revenue/orders/profit/ROAS.
- IMPLEMENTED — v0.14.46 Living Roadmap + Marketing Plan + Customer Data Analysis protocol.
- NEEDS DEPLOY/VALIDATION — verify v0.14.44–46 on production and collect enough real events to establish a baseline.

## Phase 2 — Conversion intelligence
- IMPLEMENTED — v0.14.47: Conversion + Product Demand Intelligence; groups numbered product series into families, distinguishes premade stock from demand-driven production, and recommends PRODUCE / TEST / HOLD from observed views/cart/checkout/paid data.
- NEEDS DEPLOY/VALIDATION — validate family recommendations against production traffic and sales; low exposure must not be treated as low demand.
- IMPLEMENTED — v0.14.50 Commerce/Conversion Intelligence: diagnoses Product View → Add Cart → Checkout → Paid leakage and reports new vs returning buyers without exposing PII.
- NEEDS DEPLOY/VALIDATION — use production traffic to confirm the actual bottleneck; diagnostics refuse to name a bottleneck until a stage has a minimum evidence base.

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

## Permanent QA / Security / Bug Audit roadmap
QA is a permanent Event Roadmap track. It does not need a new Event Case unless an urgent defect is found.

### Every patch — mandatory Patch Smoke Check
- **Deep Frontend Parity:** `สินค้าดิจิทัล → รายละเอียดสินค้า` และ `โปรแกรมบอท → หน้าลึก` ต้องคง Header กลาง แถบปุ่มบน GIF โปร แชท และ Boss Mobile Preview ครบเหมือนหน้าแรก; ห้ามส่งแพตหากหน้าใดขาดหนึ่งองค์ประกอบ.
- ลูกศรแคตตาล็อกซ้าย/ขวาต้องเป็น Tiffany พร้อม touch target อย่างน้อย 44px. ราคาโปรสิทธิ์คอร์ส “ลดเหลือ 499 บาท” ต้องเป็นสีแดงทั้งวลีทั้งหน้าแรกและหน้าที่นำส่วนนี้ไปใช้.
- ข้อความราคาเดิม ข้อความกำกับ และหมายเหตุบนพื้น Tiffany อ่อน/ขาวต้องใช้สี Ink เข้มและ opacity 100%; ห้ามใช้เทาอ่อนหรือเหลืองอ่อนจนอ่านแทบไม่เห็น.
- Run `npm run release:stamp-assets` before tests and ZIP delivery. `VERSION.txt` is the only cache identity; frontend HTML and first-party imports must never carry mixed manual cache versions.
- Every frontend page and Boss mobile preview route must load the canonical `frontend-theme.css` last: page background Tiffany-to-white only; actions use Tiffany/white/pale Tiffany and never a dark green or black fill except approved semantic/social surfaces.
- Animated promotional GIF integrity is permanent: four distinct frames, infinite loop, fresh runtime request on homepage and cart, and a cache-revalidation policy for mutable GIF/JS/CSS assets.
- Build, imports, changed APIs and changed pages must pass before ZIP delivery.
- Test the roles affected by the patch and the nearest legacy flow that shares its API or database tables.
- Test the affected surface on desktop and mobile; Android/iPhone routes must be included when the change touches customer-facing UI.
- Check that no secret, private customer data or cross-account data is exposed.

### Every 3 delivered patches — Integration Check
- Test the latest three patches together, including navigation, notifications and shared database/API paths.
- Test Guest, User, Admin and Boss permissions where applicable.
- Run the key commerce path: signup/login → cart → order → payment verification → unlock/license → download/use.

### Every 6 delivered patches — Full Regression
- Test all major VisionD surfaces: storefront, member, orders/payment, courses/Vision 5, Vision 1–7, ELON Web, ELON Page and Ads Center.
- Check desktop, Android and iPhone critical paths, database consistency, duplicate records and stuck jobs.

### Every 10 delivered patches — Deep Security & Data Audit
- Audit authorization bypass, cross-account access, prompt injection, license/device spoofing, webhook forgery/deduplication, rate limits, secret leakage, slip replay, audit logs, backup/restore and database performance.

### Immediate escalation to Event Case
Open an urgent Event Case immediately for build/site outage, login/mobile failure, incorrect payment unlock, cross-account data exposure, authorization/license bypass, secret leakage, destructive data mutation or a blocked critical flow. Security/payment/auth regressions always override feature work.

### High-risk patch rule
Any patch touching login, authorization, payments, database schema, ELON, webhooks or licensing receives the relevant elevated checks immediately without waiting for the 3/6/10-patch cadence.

## Permanent Requirement Coverage / Anti-Drop rule
This track detects work that disappeared from planning, not merely work that remains pending.

### Patch Work Ledger — กันงานย่อยหลุดภายในทุกแพต
This applies to every task in the current patch, not only ELON or Event Case. At patch start, register separate task IDs for feature, bug, security, database, UI/mobile, config, QA and documentation work in `patch-ledgers/vX.Y.Z.json`. Each completed task must point to concrete evidence. Run `npm run patch:coverage` before ZIP creation; any MISSING, UNCERTAIN or missing evidence blocks delivery.

1. **Requirement Ledger** — every Boss instruction must receive its own stable ID in `requirements-ledger.json`; do not merge unrelated instructions into a broad item.
2. **Patch Coverage Check** — before every ZIP, compare `original instruction → requirement ID → changed file/evidence → test result`. A requirement without a destination is at risk of being dropped.
3. **Cross-patch audit** — every Integration and Full Regression cycle must reread requirements from prior patches to catch items incorrectly marked complete or removed from the queue.
4. `DONE-VERIFIED` requires existing evidence; `PENDING` stays visible; `BLOCKED` records its blocker; `MISSING` and `UNCERTAIN` fail patch delivery; only Boss can authorize `REMOVED-BY-BOSS`.
5. Run `npm run requirements:check` before every patch. Before closing an Event Case run `npm run requirements:close`.
6. **ห้ามปิด Event Case** unless every requirement is `DONE-VERIFIED` or `REMOVED-BY-BOSS` and the final report states total, verified, pending, missing and uncertain counts.

### ตัวกันงานหลุดชั้นที่ 2 — Patch-wide + Cross-Patch Recheck
Layer 2 first rechecks every task registered for the current patch, then compares the Event Requirement history across prior snapshots. It therefore catches both work dropped inside this patch and work lost between patches.
1. หลังส่งแต่ละแพต ให้เก็บ Ledger Snapshot แบบ append-only และล็อก SHA-256 ใน `requirements-history/index.json`.
2. ก่อนส่งแพตถัดไป ต้องเทียบ Snapshot ทุกชุดกับ Ledger ปัจจุบัน เพื่อตรวจ Requirement ID ที่หายและ Snapshot ที่ถูกแก้ย้อนหลัง.
3. ข้อความ Requirement ที่เปลี่ยนต้องมี `source_change_reason`; งานที่เคย `DONE-VERIFIED` แล้วถูกเปิดใหม่ต้องมี `reopened_reason`.
4. ตรวจซ้ำว่าไฟล์หลักฐานจากแพตก่อนยังมีอยู่จริง ไม่ใช่ตรวจเฉพาะหลักฐานที่เพิ่มในแพตปัจจุบัน.
5. ทุก ZIP ต้องผ่านทั้ง `requirements:check` และ `requirements:recheck`; การปิด Event Case ยังต้องผ่าน `requirements:close` เพิ่มอีกชั้น.

## Event queues
### EVENT CASE
- IMPLEMENTED — v0.14.125 Global Test User Identity: เพิ่มสถานะยูสเทสระดับเว็บไซต์, Boss สร้างยูสเทสจากหลังบ้านได้โดยใช้ชื่อกลาง “รัฐสิทธิ ดำรงรถการ” ซ้ำได้หลายบัญชี ขณะที่ Username/อีเมลยังไม่ซ้ำ; บัญชีเก่าที่เป็น Vision 5 test ถูกย้ายและเปลี่ยนชื่ออัตโนมัติ.
- IMPLEMENTED — v0.14.124 Vision 5 Credit Deduplication + Basket Catalog: สรุปเครดิตมีเจ้าของ UI เพียงชุดเดียวและล้าง markup เก่าที่ซ้ำ, เปลี่ยนพื้นที่งานเป็น “ตะกร้าคอร์สของฉัน” แบบแคตตาล็อกพร้อมปุ่มแก้ไข/จัดการ EP/ส่งตรวจ, และบัญชีรับเงินแก้ไขภายหลังได้โดยคง QR เดิมเมื่อไม่ได้อัปโหลดใหม่.
- IMPLEMENTED — v0.14.123 Vision 5 Settings + Credit UI: ใช้คำว่าเครดิตทั้งหน้าและย้ายสรุปเครดิตไว้ถัดจากผัง 5 ขั้น, Header ใช้โครงเดียวกับหน้าหลัก, ธนาคารเป็นรายการมาตรฐานในไทย, QR ไม่บังคับ, EasySlip เปิด–ปิดได้โดยค่าเริ่มต้นปิด; บัญชีทดสอบที่ Boss ทำเครื่องหมายจะส่งสลิปให้ Boss อนุมัติเท่านั้น. กฎ Header/ปุ่มหน้าลึกยังอยู่ใน Permanent UI Theme และต้องคง parity บนมือถือ.
- IMPLEMENTED — v0.14.122 B1 LINE Setup Hardening: Boss System Health ตรวจ `VISIOND_CHANNEL_ENCRYPTION_KEY` ก่อนลูกค้ากรอก, API บอกวิธีแก้ตรงจุดและไม่ให้ Token หาย/ต้องออกใหม่; รอ Deploy และ smoke LINE จริงบน Redmi.
- IN PROGRESS — v0.14.118 B1 Slug + Key Slot Reset: แก้ global middleware ให้ PATCH จาก APK Origin:null ผ่านเฉพาะ Vision7 mobile allowlist; เพิ่มปุ่มล้างสล็อตคีย์แบบคงคีย์/ร้าน/ประวัติและ revoke session; ตารางคีย์ไม่มีแถบเลื่อนแนวนอนและแปลงเป็นการ์ดบนจอแคบ. ต้อง Deploy Web ก่อน APK และยืนยันบน Redmi.
- IMPLEMENTED — v0.14.117 B1 Shop Save + Notification Toggle: APK แสดงผลบันทึกใต้ปุ่มและมีสวิตช์ศูนย์แจ้งเตือน; v0.14.118 แก้ต้นเหตุ middleware ที่ขวาง PATCH.
- IMPLEMENTED — v0.14.116 B1 Live Shop Profile: เพิ่ม endpoint ชื่อ/Slug ร้านที่ผูกกับคีย์จริง พร้อม owner scope และ unique slug; v0.14.117 รับช่วงทดสอบมือถือ.
- IMPLEMENTED — v0.14.115 B1 Hosted Activation Handoff: Redmi ยืนยันการเปิดใช้งานและผูกร้านสำเร็จแล้ว; เหลือแก้ข้อมูลหน้าร้านใน v0.14.116.
- SUPERSEDED — v0.14.114 B1 Activation Simple Request: simple POST ยังถูก Redmi WebView ตัดก่อนถึง API จึงแทนด้วย hosted activation ใน v0.14.115.
- IMPLEMENTED — v0.14.113 B1 Activation Error Lock: รักษาค่าที่กรอกเมื่อผิดพลาดและเพิ่ม error request ID; ปัญหา preflight ถูกยกต่อเป็น v0.14.114.
- IMPLEMENTED — v0.14.112 B1 Production CORS Lock: Redmi ยืนยัน Mobile API ONLINE จริงแล้ว; health/CORS outage ปิดเฉพาะส่วนการเชื่อมต่อ แต่ activation ถูกยกต่อเป็น v0.14.113.
- IN PROGRESS — v0.14.111 B1 Live Mobile Operations: แก้ APK เชื่อม API, ยกเลิกออเดอร์ยังไม่จ่าย, แก้/ลบสินค้า, เปิดหยุดบอทและสลับ LINE/Facebook; ศูนย์แจ้งเตือนปักงานด่วน ใช้พื้นที่เหลือวางงานทั่วไป แบ่งล้นเป็นหน้า 2/3/4 และเตือนซ้ำแบบไม่ดังรัว. กฎส่งมอบถาวรคือ Boss รับเพียง Web ZIP + APK; Source มือถือเก็บ Private แยกเวอร์ชันและสำรองในทีมเจเพื่อ build/recheck เท่านั้น ห้ามแกะ APK เป็นฐานพัฒนา. ปิดได้หลังส่งสองไฟล์และ Boss smoke บน Redmi.
- IN PROGRESS — v0.14.110 B1 Three-output: VisionD Web v0.14.110, V Easy Source v1.0.9 และ signed APK v1.0.9 ต้องส่งพร้อมกัน; ปิดงานเมื่อผ่าน form parity, API/session cross-contract, generic credential-free APK, artifact integrity และบันทึก smoke test บน Redmi Note 14 Pro+ 5G เท่านั้น.
- IMPLEMENTED — v0.14.109 VBot Key Storefront: เมนู VBot เปิดหน้ารวม/รายละเอียดระดับเดียว ตะกร้าขายเฉพาะคีย์ 30 วัน/1 ปี/ตลอดชีพที่ราคาเป็นบวก ใช้ product จริงและตรวจราคาซ้ำก่อน order; เมื่ออนุมัติจึงปลดทั้งคีย์และดาวน์โหลดตัวติดตั้ง โดยกฎ 1 คีย์ = 1 ร้านยังเป็น V Easy เท่านั้น.
- IMPLEMENTED — v0.14.108 VBot Marketplace Foundation: Boss สร้างร่างแอปฟรีจากชื่อ รายละเอียด ปก ตัวติดตั้ง แพลตฟอร์มและเวอร์ชัน; ราคาเสนอขายคีย์แต่ละอายุเว้นว่างเป็น NULL ได้; ใช้ Program/Plan/Release/License เดิมและล้างงานค้างเมื่อสร้างไม่สำเร็จ. ขั้นถัดไปคือ storefront basket, paid entitlement/download และ key fulfillment โดยห้ามเปิดขายร่างที่ยังไม่มีราคา.
- IMPLEMENTED — v0.14.107 Key Mode Clarity: คีย์ทดสอบเหลือเพียงแอปและอายุ 30 วัน/1 ปี/ตลอดอายุโดยใช้บัญชี Boss อัตโนมัติ; คีย์ลูกค้าจึงค่อยแสดงลูกค้า แพ็กเกจและราคา; ข้อมูลปกติไม่ใช้กล่องเหลือง.
- IMPLEMENTED — v0.14.106 Complete License Ledger: ตารางทุกคีย์เรียง ลูกค้า → แอป/เลขคีย์ → แพ็กเกจ/อายุ → ค่าใช้จ่าย → วันที่ออก → ผู้ออก → สถานะ → จัดการ, เก็บต้นทุน ณ วันออก และคีย์ทดสอบข้อมูลไม่ครบยังทำงานได้.
- IMPLEMENTED — v0.14.105 Vision 7 Manual Key Hotfix: เพิ่มแอปได้แม้รายการสินค้าหรือ API ส่วนอื่นโหลดพัง, Product ID ว่างทั้งสามแพ็กเกจได้, มีปุ่มลองใหม่ และออกคีย์แบบ “คีย์ทดสอบไม่มีค่าใช้จ่าย” หรือ “คีย์ลูกค้าแสดงราคาตามแพ็กเกจ”.
- IMPLEMENTED — v0.14.104 Vision 7 Guided Control: หลังบ้านแสดงลำดับ เพิ่มโปรแกรม → ออกคีย์ทดสอบ → เผยแพร่ตัวติดตั้ง, มี empty state ที่บอกงานถัดไป, ปุ่มรายโปรแกรม, ตัวกรองคีย์จริง และพับแบบฟอร์ม APK ไว้จนกว่าจะใช้งาน.
- IMPLEMENTED — v0.14.103 Deep Frontend Parity: ลูกศรแคตตาล็อก Tiffany 44px, วลีลดเหลือ 499 บาทสีแดงทั้งชุด และหน้าลึก Digital Products/Product/Bots ผูก Header, GIF, chat และ Boss mobile preview เป็น contract ถาวร.
- IMPLEMENTED — v0.14.102 canonical frontend contract: 26 customer-facing pages use one Tiffany-to-white background and one non-dark action system; product cards, deep member/course pages and Boss mobile preview inherit it. Automated release stamping and revalidation remove mixed cache keys; the approved four-frame promo GIF is forced fresh and loops on homepage/cart.
- IMPLEMENTED — v0.14.101 Vision 7 Product Mapping: เลือกสินค้าจริงสำหรับข้อมูลโปรแกรมและแพ็กเกจตลอดชีพ/30 วัน/365 วัน แยกหน้าที่ชัด ตรวจ ID ซ้ำ และยังสร้างโปรแกรมเพื่อออกคีย์ทดสอบโดยไม่ผูกตะกร้าได้.
- COMPLETE — establish two-queue patch protocol and rotating roadmap tracks.
- IMPLEMENTED FOUNDATION — v0.14.51 Vision 7 licensing: program/plan/license/device/trial/history schema and APIs; 3 devices per key; account binding; customer device reset; separate member/admin pages.
- IMPLEMENTED FOUNDATION — v0.14.51 ELON Page isolated conversation/handoff storage and separate Ads Center advisory surface. Existing income dashboard remains untouched.
- IMPLEMENTED — v0.14.52 paid Vision 7 order fulfillment: quantity creates separate keys, explicit renewal extends the selected existing key, and order-item idempotency prevents duplicate issuance.
- IMPLEMENTED — v0.14.52 encrypted recoverable license keys using a dedicated production Secret; only the authenticated owner can retrieve the full key.
- IMPLEMENTED — v0.14.53 Requirement Ledger and Patch Coverage Check; delivery fails on MISSING/UNCERTAIN and Event Case closure fails while any requirement is unresolved.
- IMPLEMENTED — v0.14.53 secure inbound Meta Messenger webhook: verification token, HMAC signature, page-recipient guard, idempotent event storage and encrypted participant identity.
- IMPLEMENTED — v0.14.54 anti-drop Layer 2: hash-locked cross-patch snapshots detect removed requirements, history tampering, unexplained status regressions and missing prior evidence.
- IMPLEMENTED — v0.14.54 outbound Page sender: Cloudflare-secret Page token, 24-hour enforcement at queue and delivery, idempotency, retry schedule and protected cron processor.
- CONTINUE NEXT PATCH — PAGE_SALES AI grounded in verified VisionD catalog, pricing and policy data.
- CONTINUE NEXT PATCH — program download/update delivery and full Vision 7 operator forms/history.
- CONTINUE NEXT PATCH — production Ads API ingestion and evidence-calibrated recommendations.

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ

### EVENT ROADMAP rotation
- IMPLEMENTED — Growth/Data: v0.14.49 Personalized Product Engine.
- IMPLEMENTED — Commerce/Conversion: v0.14.50 funnel leakage diagnostics + new/returning buyer mix.
- NEXT — Product/Production: strengthen demand-driven production queue from family exposure and paid evidence.
- WAITING — Course/Creator.
- ACTIVE PERMANENT TRACK — Security/QA cadence: every patch smoke, every 3 integration, every 6 full regression, every 10 deep security/data audit, with immediate high-risk escalation.
- WAITING — Marketing: smart promo/retarget after recommendation baseline.

## Current next decision
Deploy v0.14.48–49 and validate guest acquisition plus recommendation behavior. Analyze `recommendation_view → recommendation_click → add_to_cart → purchase`. Commerce/Conversion diagnostics are now implemented in v0.14.50. Deploy and validate with real traffic. Unless production data or a new Event Case overrides it, rotate next to Product/Production Intelligence: turn family exposure/cart/paid evidence into an ordered production queue, never inventory count alone.
# v0.14.129 — Vision 5 Unified Step Colors (IMPLEMENTED)

- ทำสีพื้น สีขอบ และวงเลขของขั้นตอน 1–2–3 ให้เป็นชุดเดียวกัน
- คงสถานะขั้นปัจจุบันด้วย focus outline โดยไม่ทำสีพื้นแตกต่าง
- เพิ่ม regression test และ cache identity `014129`
# v0.14.130 — Course Management Center Naming (SUPERSEDED BY v0.14.132)

- รวมชื่อทางเข้าของผู้ขายคอร์สเป็น `ศูนย์จัดการคอร์ส`
- เปลี่ยนเส้นทางหน้าผู้ใช้เป็น `/course-center` และนำหน้าเก่าที่ไม่ใช้แล้วออกใน v0.14.132
- แยกชื่อศูนย์ออกจาก CTA `+ สร้างตะกร้าคอร์ส`
# v0.14.131 — Course Basket Inline EP Manager (IMPLEMENTED)

- รวมข้อมูลตะกร้าคอร์สและรายการ EP ในหน้าแก้ไขเดียว
- ใช้ API EP เดิมและคง content lock หลังมีผู้ซื้อ
- ปรับชื่อฟิลด์หลักเป็น `ชื่อคอร์ส`

# v0.14.132 — Course Public Detail + EP Lock (IMPLEMENTED)

- ใช้ `/course-center` เป็นเส้นทางเดียวของ `ศูนย์จัดการคอร์ส` และไม่เก็บหน้า `/course-seller.html` เก่า
- เพิ่มหน้ารายละเอียดคอร์สก่อนซื้อที่แสดงข้อมูลขายและจำนวน EP แต่ไม่เปิดชื่อ EP วิดีโอ หรือไฟล์ประกอบ
- หลังชำระและได้รับสิทธิ์ แสดงเปอร์เซ็นต์ ความคืบหน้า และปุ่มเริ่มเรียน/เรียนต่อ โดยใช้ API EP ที่ตรวจ entitlement เดิม
- รวมปุ่ม `ส่งเผยแพร่ให้ Boss ตรวจ` ไว้ท้ายรายการ EP ในหน้าแก้ไขตะกร้าคอร์ส

# v0.14.133 — Course Basket Form Layout (IMPLEMENTED)

- จัดรูปปกไว้คอลัมน์ซ้าย และเรียงชื่อคอร์ส ผู้สอน คำอธิบายสั้นทางขวาโดยช่องกรอกไม่ยืดตามความสูงรูป
- มือถือกลับเป็นคอลัมน์เดียวตามลำดับอ่าน ไม่เกิดช่องว่างหรือช่องกรอกหล่นกลางกล่อง
- เปลี่ยน CTA ท้าย EP เป็น `เผยแพร่และรอตรวจสอบ` โดยไม่แก้ค่าเดิมของชื่อคอร์ส
- แก้ปุ่ม `แก้ไข EP` ให้เปิดฟอร์มที่เติมข้อมูลเดิม โฟกัสชื่อ EP และไม่ถูก CSS Grid ทับสถานะ hidden
