# v0.20.85 — explicit sold-order acquisition

Date filtering remains a cached read. The selected channel now has an explicit order-fetch/retry/next-page action; no provider call occurs on passive load. Missing scope, never synced, partial, running, failed and capped results cannot be represented as verified zero sales.

Migration0101 must precede code deployment. Coverage uses exact connection/Thai date range primary key, revision/request CAS,90-second lease and one provider page24 per explicit action. All page order writes and completion checkpoint are atomic; failed retries retain existing orders. No new OAuth, Helper, profile or token namespace changes. Older ranges can fetch before noon; the latest not-yet-ready day retains the existing daily gate. Requested range is limited to90 calendar days.

Existing stored summary arrays remain capped5000; capped results are explicitly incomplete and ask for a smaller date range. Provider pagination/checkpoint never relies on that local display cap. Completion means the provider exhausted the exact range at the recorded sync time, not that future attribution updates cannot occur.

Official current scope for POST /affiliate_creator/202410/orders/search: creator.affiliate_collaboration.read. This is projected independently of showcase_ready. Provider input keeps exact raw order and supports id/create_time/skus; no seller token is used.

Validation: scripts/test-v02085.mjs and canonical test:v02085. Actual provider production data and user click remain a Root-owned post-release gate.
