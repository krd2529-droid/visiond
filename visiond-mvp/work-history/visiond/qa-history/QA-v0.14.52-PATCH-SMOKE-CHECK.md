# QA v0.14.52 — Mandatory Patch Smoke Check

- PASS — Node syntax: Vision 7 crypto/schema/order fulfillment, order API, license APIs and affected frontend scripts
- PASS — Predeploy import and HTML asset checks
- PASS — Vision 7 quantity path permits repeated program products while legacy digital products remain single-purchase
- PASS — Renewal validates owner, program and non-lifetime plan
- PASS — Fulfillment is idempotent per order item
- PASS — Full key is encrypted at rest and returned only through authenticated owner query
- PASS — Existing income dashboard files were not modified
- PASS — Existing role checks remain on admin/member APIs
- CONFIG REQUIRED — `VISION7_LICENSE_ENCRYPTION_KEY` must be set in Cloudflare before production Vision 7 sales

This patch touches payment, database schema and licensing, so elevated static security checks were run immediately under the new high-risk patch rule.
