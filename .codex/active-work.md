# Active patch: Resolve sold product names

- Status: READY
- Requested outcome: replace generic `สินค้า <product_id>` labels with authoritative product names whenever TikTok data provides them.
- Add: extract product names from stored order payloads first; enrich unresolved IDs through the official product-detail-by-ID flow when available.
- Preserve: order counts, grading, date filtering, Showcase behavior, channel isolation, and generic fallback only when no authoritative detail exists.
- Acceptance: an ordered product outside the current Showcase can still display its real name; no cross-channel product metadata leaks; unresolved products remain explicit fallbacks.
- Likely files: TikTok Shop sync/API normalizer, admin connection response, analyzer client, regression test.
- Phase: implementation complete; targeted regression, syntax, channel-isolation, grading, and sync-contract checks passed.
- Verification: new order-name regression PASS; TikTok Shop sync PASS; one-card-one-channel isolation PASS; sold-product grading PASS; diff check PASS. Four unrelated legacy Marketplace assertions remain stale against already-delivered category/copy behavior.
- Delivery: commit and push only related files to `origin main` after verification.
