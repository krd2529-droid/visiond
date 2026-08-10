# JARVIS Patch Protocol — VisionD

When a VisionD ZIP is received with `J` or `เจ`:
1. Read VERSION, latest PATCH note, VISIOND-ROADMAP, VISIOND-MARKETING-PLAN and CUSTOMER-DATA-ANALYSIS.
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
