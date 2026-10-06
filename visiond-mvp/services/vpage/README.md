# Vpage service

This Cloudflare Worker is intentionally deployable separately from VisionD in the isolated Vpage account. It owns the Vpage domain registry, public slug routing, and provisioning lifecycle. VisionD never sends customer HTML or browser credentials to it.

## Local setup

1. Set the isolated account's D1 database ID in `wrangler.toml`; `wrangler.toml.example` is the unchanged reference template.
2. Apply `migrations/0001_vpage_service.sql` through Wrangler D1 migrations.
3. Set `VPAGE_SHARED_SECRET` with `wrangler secret put`; use the same minimum-32-character secret only in VisionD's server environment.
4. Set matching `VPAGE_KEY_ID` values and configure VisionD's non-secret `VPAGE_API_BASE` after deployment.

Do not put the shared secret in the manifest, browser, logs, or repository. The API signs the method, exact path/query, key ID, timestamp, nonce, owner reference, and body hash. Nonces are single-use. Mutating operations also require an idempotency key.

The pilot seeds only `smartlinkpage.com` in slot 1. Slots 2–10 are schema capacity, not invented or purchased domains. Route or DNS changes remain a separate authenticated deployment step.
