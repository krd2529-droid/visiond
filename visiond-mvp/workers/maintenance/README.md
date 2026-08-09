# VisionD maintenance Worker

Separate Cloudflare Worker that calls the Pages maintenance endpoints once a day. It runs ELON chat retention (60 days) and raw Analytics retention (90 days). Each job has its own secret and bounded three-attempt/eight-second request policy.

## Deploy

1. Keep the deployable `wrangler.toml` free of environment-specific values. `wrangler.toml.example` shows a valid origin for reference. Add the exact HTTPS origin of the Pages site as a Worker secret (a trailing `/` is accepted, but no other path, query, or credentials are allowed):

   ```sh
   npx wrangler secret put APP_ORIGIN --config workers/maintenance/wrangler.toml
   ```
2. Generate two different random values of at least 32 characters. Set the same values on the Pages project as `ELON_CLEANUP_TOKEN` and `ANALYTICS_CLEANUP_TOKEN`.
3. Add the Worker secrets without committing them:

   ```sh
   npx wrangler secret put ELON_CLEANUP_TOKEN --config workers/maintenance/wrangler.toml
   npx wrangler secret put ANALYTICS_CLEANUP_TOKEN --config workers/maintenance/wrangler.toml
   ```

4. Deploy from the repository root:

   ```sh
   npx wrangler deploy --config workers/maintenance/wrangler.toml
   ```

The cron is `18:17 UTC`, which is `01:17` in Thailand the following day. Cloudflare cron expressions always use UTC. The Worker never logs or returns a secret. A failed invocation is visible in Cloudflare Worker observability as a generic maintenance error.

Run its unit tests with `npm run test:maintenance-worker`.
