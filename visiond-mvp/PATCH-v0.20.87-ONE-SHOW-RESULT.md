# v0.20.87 — one แสดงผล action

The date form has one button, exactly แสดงผล when idle. One explicit submit reads authoritative exact-range revision then sequentially fetches every provider page until complete. Internal page size24 is transport only, never a user-visible pagination control or total result limit. No arbitrary total-page cap or passive provider request is added.

Each completed partial page advances revision and uses a fresh logical request ID. Same-range concurrent submits coalesce. Network ambiguity preserves its request ID; the next explicit click resumes durable progress. An explicitly selected previously complete range starts a fresh provider pass. Running, non-advancing revisions, missing access or failure stop without hot loops; old data/checkpoint remain. Channel/date/owner/page/form/workspace changes stop further requests and prevent stale rendering.

Backend scope,90-day range, D1 breaker, atomic deletion guard and durable cursor are unchanged, as are v86 no-noon, Helper and OAuth. The removed v85 two-button test contract is replaced by scripts/test-v02087.mjs; all database and integrity regressions remain.
