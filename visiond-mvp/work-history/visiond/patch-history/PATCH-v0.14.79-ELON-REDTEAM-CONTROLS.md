# PATCH v0.14.79 — ELON Red-team and Independent Controls

- Red-team coverage for public sales, private-account login boundaries, jailbreak, secrets, PII, cross-account ownership, draft/full-file exclusion and provider-output leakage.
- Historical assistant answers use provider DLP rather than user authorization, preventing safe sales text from becoming an Admin refusal after reload.
- Boss Admin has independent switches for ELON Web and ELON V7.
- ELON Web setting lives in `ELON_WEB_DB`; ELON V7 setting lives in `ELON_V7_DB`. ELON V7 defaults off.
- ELON Web endpoints return service unavailable while its switch is off.

Deployment requires both physical D1 bindings and their migrations. No ELON V7 conversational feature is introduced in this patch.
