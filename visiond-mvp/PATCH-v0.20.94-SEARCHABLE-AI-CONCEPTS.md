# v0.20.94 — Searchable AI concepts

Grade-E recommendations are unverified concepts, not catalog listings. Each has an editable concise search query and explicit Marketplace search action. Legacy names use narrow product-intent patterns; unfamiliar names remain editable. Only returned TikTok catalog results are represented as actual listings, and empty results invite an explicit broader/edit retry.

Marketplace requests retain existing filters and bounded pagination, use immutable owner/channel/query/filter/cursor snapshots, coalesce identical in-flight requests, serialize calls, and cache at most24 result sets for30 seconds. Late channel/query results do not repaint. No passive searches or inventory writes were added. Existing explicit E selection remains E.

AI prompt/output normalization, actual render→click→API tests, exact screenshot-shaped examples, dedup/pagination/races, canonical94→72, visible-version and predeploy pass. No schema, native or provider changes. Real provider availability cannot be guaranteed by a concept search; release and user visual verification remain separate.
