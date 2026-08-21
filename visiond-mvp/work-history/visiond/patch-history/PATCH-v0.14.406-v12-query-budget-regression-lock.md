# PATCH v0.14.406 — V12 Query-Budget Regression Lock

## Locked Budgets

- Inbox list polling: active 60 วินาที, idle 300 วินาที, hidden tab 0
- Conversation list: ไม่เกิน 200 และ latest-message probe 1 ครั้งต่อบทสนทนา
- Thread page: 50 ข้อความ + 1 แถวตรวจ `has_more`
- Schema readiness: point probe 1 ครั้งต่อ isolate และข้าม V12 DDL เมื่อ v66 พร้อม
- AI reply history: ไม่เกิน 10 ข้อความต่อ customer event
- Facebook history import: manual เท่านั้น สูงสุด 25 conversations × 100 messages ต่อหน้า

## Verification

- `scripts/test-v12-query-budget.mjs`
- `scripts/test-v014406.mjs`
- Patch gate: focused, visible version, regression และ predeploy

## Remaining Production Evidence

- Push/Deploy v0.14.405–406
- ตรวจ Cloudflare D1 Query Insights และ Rows read/written หลัง 24 ชั่วโมง
- Static code budget ปิดครบ แต่ห้ามอ้างเปอร์เซ็นต์ Production จนมีข้อมูลจริง

## Delivery

- Commit เท่านั้น
- ไม่ Push และไม่ Deploy

EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ
