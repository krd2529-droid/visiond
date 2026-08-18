# PATCH v0.14.78 — ELON Web Guest/Customer Sales

## Outcome

- ELON Web is a storefront sales team for both Guest and logged-in customers.
- Guest can ask about published products, price, trust, buying, payment, slip upload and download journeys without login.
- Account-specific questions require login; Guest history is bound to a one-way anonymous subject hash.
- Provider-output DLP is separated from user-request authorization, so safe sales phrases are no longer replaced by an Admin-only refusal.
- ELON Web continues to use only `ELON_WEB_DB`; no ELON V7 code or data was added.

## Verification

- `npm run test:v01478`
- JavaScript syntax checks
- Historical database split check `npm run test:v01477`

## Deployment prerequisite

Configure and migrate the physical `ELON_WEB_DB` D1 binding. ELON Web fails closed when the binding is absent. `ELON_V7_DB` remains a separate reserved database.
