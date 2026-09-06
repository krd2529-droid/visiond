# Vtools / VX 30-day access

- Catalog: `/vtools`, linked from homepage. Existing `vd_cart` and order/slip approval workflow.
- Prices are server-authoritative satang: 10 TikTok channels = 49000; 20 = 98000; 30 = 129000. VX is excluded from promotions and permanent download entitlements.
- One VX package per checkout; pending VX orders prevent another pending checkout. Paid packages can be renewed.
- Approval creates one grant per order in the same D1 batch as the `pending_review` to `paid` transition. Replays do not extend dates.
- First grant starts on approval. Renewals start after the latest paid grant expires and last 30 days. Limits do not stack; changed limits apply at the next period. No recurring billing.
- VX automatically verifies uploaded slips with the platform EASYSLIP_API_KEY, independent of the Vision3 auto-verify toggle. Exact amount, recipient match and provider/local duplicate checks are required before granting rights. Missing key, provider failure or mismatch leaves the order for review without granting rights. No customer-owned EasySlip token is required.
- Access requires paid order status and `starts_at <= now < expires_at`. Refund removes that order's access; a queued grant keeps its scheduled dates.
- Dedicated VX authorization permits paying customers only on owner-scoped TikTok endpoints. Admin/boss access is preserved; other admin endpoints remain admin-only.
- OAuth channel insert and restore are conditional SQL writes with an active-channel count. Paid users cannot use the retired manual channel-creation endpoint. When over quota after a downgrade, use is blocked until excess channels are removed. Channel listing/deletion and consent revocation remain available after expiry.
- Schema migration: `0081_vx_access.sql`; runtime helper also safely initializes the table and three products. Existing unpublished/deleted plans are not reopened on upsert.
- Tests: `node scripts/test-vtools-access.mjs`; `node scripts/test-vtools-browser.mjs` (Playwright package and optional installed browser via `PLAYWRIGHT_PACKAGE` / `PLAYWRIGHT_CHANNEL`). In-memory database and local HTTP only, no real payment or user data.
- Known unrelated baseline: `test-commerce-final.mjs` fails its mobile-shell assertion on unchanged `public/blog.html`; commerce-specific assertions preceding it pass.
