# Patch v0.20.105 — Boss Partner commission view restore

- Persists only `products` or `boss-partner-commission` in session storage with the authenticated owner ID.
- Restores the Partner controller only for the same verified Boss, after channels finish loading, without reading commission data.
- Keeps the Partner controller across selected-channel and profile refreshes while clearing stale results and advancing its generation guard.
- Prevents ordinary shop-portfolio commission rendering from replacing the active Partner-owned container; product and Showcase refreshes continue normally.
- Uses one explicit Tiffany action named `ดูยอด`; only that submit may call the dedicated Partner-order endpoint.
- Keeps the legacy mixed Commission Center workspace disabled and makes no backend, schema, D1, provider, collector, referral, or live-data change.
- Focused regression: `npm run test:v020105`.
