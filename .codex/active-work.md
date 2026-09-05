# Active patch: Complete VisionD nine-item queue

- Status: PATCH_DELIVERED
- Outcome: deliver the nine queued TikTok Lab, content, and session-security requirements without mock data or cross-account state.
- UI: remove review-demo route/data; move sold-product controls/table to the start of view 2; place and rename each control above its table; make sidebar channel cards authoritative; add the real A/B/C/no-grade legend after the sold-products table.
- OAuth: verify channel ownership; preserve concurrent channel states; restore the selected channel after callback; keep creator tokens isolated by user/open_id/channel and expose missing scopes clearly.
- Marketplace: search/filter by the real shop name returned by TikTok; show best sellers from units_sold; show “new” only when TikTok returns an authoritative timestamp; preserve batch-20 Showcase adds and per-product errors.
- Content: replace legacy tattoo blog content with current VisionD feature articles, SEO/GEO metadata, structured data, sitemap entries, and redirects/canonical handling for old URLs.
- Security: non-Boss accounts keep only the latest valid session across web and Vision7 surfaces; Boss remains multi-device; password-change/reset revocation remains strict.
- Preserve: existing user data, Showcase records, orders, snapshots, PowerPoint/notebook features, unrelated routes, and production deployment protocol.
- Verification: focused regressions for every item, syntax/predeploy/version gates, clean diff review, commit/push origin main, production HTML/API/browser verification.
- Phase: implementation, adversarial review, regression gates, and production verification complete.
- Delivery: `v0.20.48`, commit `7167406c`, verified on `https://visiondonline.com` on 2026-09-05.
