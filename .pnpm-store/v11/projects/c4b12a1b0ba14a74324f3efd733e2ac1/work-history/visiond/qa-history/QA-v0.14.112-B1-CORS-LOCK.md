# QA v0.14.112 — B1 Production CORS Lock

## Confirmed production failure
Production did not contain `/api/vision7/mobile-health`, served the SPA HTML at that path, and omitted `x-veasy-app-version` from allowed preflight headers. APK v1.0.10 therefore failed before activation logic ran.

## Automated gates
- Build the real Cloudflare Pages Functions worker and send `Origin: null` OPTIONS/GET through its generated router.
- Verify approved health, activation, events and runtime paths; reject evil origins.
- Verify v1.0.11 does not depend on the previously rejected custom header.
- Verify JSON health/fallback diagnostics, canonical bot contract, scoped PII-free events, version pair, APK structure and signature.

## Required Redmi smoke — pending
1. Deploy Web v0.14.112 first.
2. Install APK v1.0.11 and press Test VisionD; result must be ONLINE.
3. Activate with the real account/key/shop.
4. Load products/orders, bot readiness and events; none may show CORS/network.
