# VisionD Roadmap — Living Plan

Updated: 2026-08-15
Current build: v0.14.186

## v0.14.186 — One Request = One Event Case Completion Guard (IMPLEMENTED)
- งานที่ Boss สั่งหนึ่งเรื่องเป็น Event Case เดียว และห้ามปิดเคสเพียงเพราะจบหนึ่งแพตช์หรือหนึ่งงานย่อย
- หากยังเหลืองาน ต้องแจ้งรายการที่เหลือและงานถัดไปอย่างเด่นชัดก่อนรับเรื่องใหม่
- Boss สั่งพักหรือเปลี่ยนลำดับได้ แต่ต้องบันทึก `PAUSED BY BOSS` และไม่อ้างว่าเคสเสร็จ

## v0.14.185 — Mandatory Patch Handoff + Safe Rollback (IMPLEMENTED)
- ทุกแพตช์ต้องบันทึกสิ่งที่แก้ ไฟล์ที่แก้ ผลทดสอบ Commit identity และวิธีย้อนกลับ
- แยก parent commit ออกจาก safe rollback commit และเลื่อน Safe Baseline ได้เฉพาะเมื่อ Production validated
- ใช้ `git revert` แบบไม่ทำลายประวัติ ห้ามวางไฟล์เก่าทับทั้งระบบ ห้าม Reset/Push/Deploy อัตโนมัติ

## v0.14.184 — Roadmap Historical Continuity (IMPLEMENTED)
- รวมประวัติ v0.14.163–v0.14.183 จาก Git และ Patch Ledger กลับเข้าสู่ Roadmap กลาง
- ระบุแพตที่ถูกย้อนกลับและงานที่ยังรอตรวจ Production ตามสถานะจริง

## v0.14.183 — Mobile Menu + Product Status Pagination (IMPLEMENTED)
- ย้ายเมนูมือถือเป็นแถบยาวใต้หัวเว็บ ไม่ชนเลขแพตช์
- แยกตะกร้าวางจำหน่ายหน้าละ 10 และแบบร่างหน้าละ 5 พร้อม pagination คนละชุด

## v0.14.182 — Storefront/Admin Category Count Parity (IMPLEMENTED)
- ตัวนับหมวดหลังบ้านใช้เงื่อนไขสินค้าที่เผยแพร่เดียวกับหน้าบ้าน
- ซ่อนหมวดประเภทซ้ำที่มี 0 สินค้าเมื่อมีหมวดประเภทเดียวกันใช้งานจริง

## v0.14.181 — Minimal Production Version Repair (IMPLEMENTED)
- ยืนยัน `visiond-mvp` เป็น Cloudflare Production tree
- เปลี่ยนเฉพาะ VERSION และ badge WEB/ADMIN โดยไม่ซิงก์ Runtime จำนวนมาก

## v0.14.180 — Full-tree Production Sync (REVERTED)
- การซิงก์ไฟล์จำนวนมากทำให้หน้าเว็บเหลือเพียงเลขเวอร์ชันบนหน้าขาว
- ย้อนทั้งชุดด้วย `eddde97`; ห้ามใช้ v0.14.180 เป็นฐาน Production
- บทเรียนถาวร: ใช้ Delta ขนาดเล็กกับ Active tree และตรวจหน้าเว็บก่อนงานถัดไป

## v0.14.179 — Production Tree + QA Hardening (IMPLEMENTED)
- ระบุ Active Production tree, ซ่อม regression บน Windows และ requirement recheck
- บังคับ cache version และเลขแพตช์ที่มองเห็นได้ทุกงาน

## v0.14.178 — Course Partner Share Button (IMPLEMENTED)
- หลังบ้านระบุตะกร้าแผน Partner และดูส่วนแบ่งรายตะกร้า โดยจำกัดสิทธิ์เฉพาะหลังบ้าน
- การทดสอบออเดอร์จริงหลัง Deploy ยังเป็น Production QA

## v0.14.177 — Vision 5 Partner Share Formula (IMPLEMENTED)
- แบ่งยอด VisionD/ผู้สอน 50/50 ก่อน แล้วหัก API 1 บาทจากส่วนผู้สอน
- ตัวอย่างราคา 100 บาทได้ VisionD 51 บาท / ผู้สอน 49 บาท พร้อม ledger และรอบจ่าย

## v0.14.176 — Visible Version Runtime Source (IMPLEMENTED)
- ทำ VERSION เป็นแหล่งเดียวสำหรับเลข Home, Admin และ Dashboard พร้อม cache refresh

## v0.14.175 — Vision 5 Partner Money Flow (IMPLEMENTED)
- Routing เงินเข้าบัญชีกลาง ตรวจสลิปส่วนกลาง และ ledger ส่วนแบ่งแบบ idempotent
- เพิ่มยอดคงเหลือผู้สอนและบันทึกจ่ายหลังบ้าน; Bank/Slip E2E จริงยังรอ Production

## v0.14.174 — Vision 5 Three Seller Plans (FOUNDATION IMPLEMENTED)
- วางโครง 3 แผนผู้ขาย พร้อมกฎฟรี 3 คอร์ส คอร์สละไม่เกิน 5 EP
- ระบบ Partner ledger/การจ่ายถูกทำต่อใน v0.14.175–178

## v0.14.173 — Catalog Performance + Mobile Menu Counts (IMPLEMENTED)
- ลดภาระ API และนับเฉพาะสินค้าที่เผยแพร่ พร้อมซ่อมเมนูมือถือ
- การเทียบ D1 จริงต้องอาศัยสิทธิ์ Production

## v0.14.172 — Bundle Deals Admin Builder (IMPLEMENTED)
- เพิ่มเครื่องมือสร้างชุดสินค้า รวมไฟล์ ปก และคำอธิบายตามจำนวนในชุด
- Catalog count audit ถูกทำต่อใน v0.14.173 และ v0.14.182

## v0.14.171 — Product Form Contract (IMPLEMENTED)
- เพิ่มสัญญาทดสอบฟอร์มสินค้า ป้องกันช่องกรอกและการบันทึกเดิมเสีย

## v0.14.170 — Baseline Consolidation (IMPLEMENTED WITH LARGE LEGACY CLEANUP)
- รวมฐาน LINE/Vision 5 และลด Runtime/CSS เก่าที่ซ้ำจำนวนมาก
- เป็นการเปลี่ยนโครงใหญ่ในประวัติ ไม่ใช่รูปแบบ Delta ที่ใช้ในปัจจุบัน

## v0.14.169 — Grounded Product Knowledge Sales (IMPLEMENTED)
- LINE AI ใช้ข้อมูลสินค้าจริงและราคาเป็นบาท ตอบต่อเนื่องเชิงปรึกษา
- ห้ามอ้างสถานะสั่งซื้อหรือส่งของที่ไม่มีจริง

## v0.14.168 — Internal Mobile LINE Inbox (IMPLEMENTED)
- เพิ่มบทสนทนา LINE, handoff, คนตอบ, push และคืนให้บอท โดยไม่เปิดเผย credentials

## v0.14.167 — LINE Chat Status Refresh (IMPLEMENTED)
- ทำสถานะ connected/running ให้ตรงกันหลังตั้งค่า โดยไม่คืน credentials

## v0.14.166 — Persistent Mobile LINE Settings (IMPLEMENTED)
- มือถือจำสถานะการตั้งค่า ส่วน credentials จริงเข้ารหัสและอยู่ฝั่ง Server

## v0.14.165 — LINE Status Self-Heal (IMPLEMENTED)
- ซ่อมสถานะหน้าแชตจากผล Verify จริงโดยไม่ต้องกรอก Token ใหม่

## v0.14.164 — V Easy LINE Diagnostics (IMPLEMENTED)
- เก็บข้อความก่อนเรียก AI และแสดง last_error/ความพร้อม AI/LINE

## v0.14.163 — V Easy LINE AI Reply (IMPLEMENTED)
- เชื่อม LINE webhook กับ AI/Reply API แยกร้านและกัน redelivery ตอบซ้ำ



## v0.14.165 — LINE Status Self-Heal
- ซ่อมสถานะหน้าแชตจากผล Verify จริงอัตโนมัติ

## v0.14.164 — V Easy LINE Diagnostics
- เก็บข้อความก่อนเรียก AI และบล็อกการเริ่มบอทเมื่อ AI/LINE ยังไม่พร้อม

## v0.14.163 — V Easy LINE AI Reply
- LINE webhook ตอบด้วย AI จากสินค้าเฉพาะร้านและกัน redelivery ตอบซ้ำ
- รอทดสอบข้อความจริงหลัง Deploy ก่อนปิด Event Case
Owner protocol: JARVIS / J

## Patch Capacity / Quality Gate (บังคับตั้งแต่ v0.14.55)

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
# v0.14.187 — Template และปุ่มมาตรฐาน (2026-08-15)

- Event Case: ทำมาตรฐานปุ่มกลางครบทุกหน้าและมือถือ
- สถานะ: IMPLEMENTED รอผลทดสอบและ commit ในเครื่อง
