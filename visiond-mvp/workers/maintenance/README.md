# VisionD maintenance Worker

Separate Cloudflare Worker that calls the Pages maintenance endpoints once a day. It runs ELON chat retention (60 days), raw Analytics retention (90 days), and creates up to five published SEO sales pages from real published products. Each job has its own secret and bounded three-attempt/eight-second request policy. A separate five-minute event can monitor the account-wide Cloudflare D1 daily row quota and update the storefront auto-breaker without querying D1.

## Deploy

1. Keep the deployable `wrangler.toml` free of environment-specific values. `wrangler.toml.example` shows a valid origin for reference. Add the exact HTTPS origin of the Pages site as a Worker secret (a trailing `/` is accepted, but no other path, query, or credentials are allowed):

   ```sh
   npx wrangler secret put APP_ORIGIN --config workers/maintenance/wrangler.toml
   ```
2. Generate four different random values of at least 32 characters. Set the same values on the Pages project as `ELON_CLEANUP_TOKEN`, `ANALYTICS_CLEANUP_TOKEN`, `SEO_AUTOMATION_TOKEN`, and `D1_QUOTA_BREAKER_TOKEN`.
3. Add the Worker secrets without committing them:

   ```sh
   npx wrangler secret put ELON_CLEANUP_TOKEN --config workers/maintenance/wrangler.toml
   npx wrangler secret put ANALYTICS_CLEANUP_TOKEN --config workers/maintenance/wrangler.toml
   npx wrangler secret put SEO_AUTOMATION_TOKEN --config workers/maintenance/wrangler.toml
   npx wrangler secret put D1_QUOTA_BREAKER_TOKEN --config workers/maintenance/wrangler.toml
   ```

4. After explicit approval, create a least-privilege Cloudflare API token with Account Analytics Read for the exact account. Store it only as `CF_ACCOUNT_ANALYTICS_TOKEN`, and store the 32-character account identifier as `CF_ACCOUNT_ID`:

   ```sh
   npx wrangler secret put CF_ACCOUNT_ANALYTICS_TOKEN --config workers/maintenance/wrangler.toml
   npx wrangler secret put CF_ACCOUNT_ID --config workers/maintenance/wrangler.toml
   ```

   Do not deploy the five-minute cron until both values are approved and a real `d1AnalyticsAdaptiveGroups` sample has been validated. Missing or invalid analytics configuration is reported as unavailable; it is never treated as zero usage.

5. Deploy from the repository root:

   ```sh
   npx wrangler deploy --config workers/maintenance/wrangler.toml
   ```

The maintenance cron is `18:17 UTC`, which is `01:17` in Thailand the following day. The quota monitor cron is every five minutes. Cloudflare cron expressions always use UTC. The monitor makes one account-wide daily aggregate request per durable interval and closes at 70% of either the Free-plan read or write allowance; automatic reopening requires a fresh newer-UTC-day sample below 60% for both metrics. It never clears the independent manual storefront pause. The Worker never logs or returns a secret. A failed invocation is visible in Cloudflare Worker observability as a generic maintenance error.

Run its unit tests with `npm run test:maintenance-worker`.
