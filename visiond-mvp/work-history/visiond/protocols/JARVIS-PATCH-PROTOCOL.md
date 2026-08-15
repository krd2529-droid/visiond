# JARVIS Patch Protocol — VisionD

When a VisionD ZIP is received with `J` or `เจ`:
1. Read `VERSION.txt`, `START-HERE.md`, the latest note in `work-history/visiond/patch-history/`, `work-history/visiond/roadmap/VISIOND-ROADMAP.md`, `work-history/visiond/roadmap/VISIOND-MARKETING-PLAN.md`, and `work-history/visiond/roadmap/CUSTOMER-DATA-ANALYSIS.md`.
2. Inspect available aggregate customer/business data before choosing work. Never invent production findings when data is unavailable.
3. Preserve security boundaries, especially Boss/Admin/User/Guest and Elon isolation.
4. Implement the selected patch with minimal regression surface.
5. Run relevant QA, security/regression and predeploy checks.
6. Update VERSION and patch notes.
7. Update roadmap statuses: Implemented / Deployed / Validated separately.
8. Update marketing plan from measured outcomes.
9. Update customer-data analysis with privacy-minimized findings and the evidence window used.
10. Report after delivery: what changed, what data says, what remains, and the recommended next patch.
11. If the current roadmap/marketing phase is complete, draft the next phase automatically as PROPOSED for Boss review.

Data rule: aggregate/minimum necessary. Never place customer PII, slip data, secrets, tokens or API keys in roadmap/marketing/handoff files.


## Guest identity rule
Never collapse unauthenticated visitors into one `guest` identity. Use the platform's hashed per-browser/device visitor key. When a guest authenticates, claim prior events into the user where technically safe. Treat device/browser identity as a technical visitor, not proof of a unique natural person.

## First-order gift rule
The automatic digital gift is granted only after an authoritative paid first customer order, exactly once, from backend logic. System gift orders must be identifiable and excluded from revenue. Analyze its real conversion uplift before expanding the incentive.

## Event queue rule (v0.14.49+)
Every patch has two ordered queues.
1. `EVENT CASE` — Boss-inserted/ad-hoc work. Always execute first.
2. `EVENT ROADMAP` — planned work. Use remaining safe patch capacity only after Event Case is complete.
If an Event Case cannot safely finish in one patch, mark it `CONTINUE NEXT PATCH`, state the exact remaining scope at delivery, and keep it ahead of all roadmap work. Never let unfinished cases silently pile up.

Roadmap work rotates across major tracks so one track cannot monopolize releases: Growth/Data → Commerce/Conversion → Product/Production → Course/Creator → Security/QA → Marketing, then repeat. Production evidence, security, payment or auth risk may override rotation.

After every patch report: Event Case completed/remaining; Event Roadmap completed/remaining; data signals; exact recommended next patch order.

## Permanent template control rule (v0.14.189+)

- Every Event Case and Event Roadmap queue that creates or changes a page must reuse the canonical VisionD template assets before adding page-specific CSS.
- The language switcher is one compact pill: content-width, maximum 100% of its container, TH/EN controls centered, and never a full-width navigation row on mobile.
- The canonical header renders exactly one cart action. Its badge must use the normalized `vd_cart` quantity total: unique digital/program products count once, Vision 5 resale rights use their valid quantity, and the total is capped at 30.
- The mobile menu toggle is a responsive layout control, not a canonical content button. It must stay hidden above 800px, appear only at 800px or below, and remain exempt from runtime button classification.
- Boss/Admin account surfaces must lead with Control Center work. Do not render the member account sidebar, its mobile menu toggle, or customer notification message cards for staff; those components remain available only to member/customer roles.
- Desktop, Android-size and iPhone-size template checks are mandatory. New one-off header, language-switcher or button geometry is forbidden unless Boss approves a named exception.


## EVENT CASE STATUS REPORTING
After EVERY patch, the delivery report MUST end with exactly one clear Event Case state:
- `EVENT CASE: เสร็จทั้งหมดแล้ว — พร้อมรับ Event Case ใหม่`
- `EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ`
If unfinished, list every remaining Event Case item and make continuation the next-patch priority. Never mark a case complete because only one subtask shipped.

## Mandatory patch handoff + rollback rule (v0.14.185+)

Every patch must record these five items before delivery:
1. What changed — concise scope and intended outcome.
2. Changed files — exact repository paths.
3. Tests — commands/contracts and pass/fail/warn results.
4. Commit identity — use `SELF` inside the patch ledger because a Git commit cannot contain its own final hash; resolve it with `git log -1 --format=%H -- <ledger-file>`. Report the resolved hash after commit.
5. Rollback — record both `parent_commit` and `safe_rollback_commit`, plus a non-destructive `git revert` procedure. Never assume the parent is production-safe.

Required files:
- `SAFE-BASELINE.md` — last production version/commit explicitly validated by Boss, plus unvalidated candidate.
- `patch-ledgers/vX.Y.Z.json` — machine-readable five-item handoff.
- `work-history/visiond/patch-history/PATCH-vX.Y.Z-*.md` — human-readable reasoning and cautions for material patches.

Status meanings must stay separate:
- `IMPLEMENTED`: code and local QA complete.
- `PUSHED`: Boss pushed the commit.
- `DEPLOYED`: hosting completed.
- `PRODUCTION_VALIDATED`: Boss or recorded live evidence confirmed critical paths.
Only `PRODUCTION_VALIDATED` may replace the safe baseline.

Rollback safety:
- Prefer `git revert <bad-commit>` to preserve later history and data.
- Never use broad file overlay, `git reset --hard`, automatic Push, or automatic Deploy.
- Re-run regression, predeploy, security scan and visible-version checks on the revert commit.

## One request = one Event Case completion guard (v0.14.186+)

- Treat one user-requested topic as one Event Case with a clear completion condition.
- Do not mark the Event Case complete merely because one patch, one turn, one commit, or one subtask finished.
- If any required part remains at delivery, the final report must prominently state: `EVENT CASE: ยังไม่เสร็จ — ต้องทำต่อให้จบ`.
- The report must list every remaining item, the exact blocker/status, and the next action required to finish.
- Before starting an unrelated new Event Case, warn Boss that the active Event Case remains unfinished and recommend completing it first.
- Boss may explicitly reorder or pause work; record that decision as `PAUSED BY BOSS` without mislabeling the Event Case complete.
- A new request that adds acceptance criteria to the active topic remains part of the same Event Case.
