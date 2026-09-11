# v0.20.91 — Sold-product shortlist

Sold table and shortlist action share Showcase plus order-detail product identity by ID. A real order-only product can be explicitly selected without a URL; missing links remain shown honestly. Blank/placeholder names are unavailable. Kept rows, sales-derived grade, owner-scoped writes and inventory refresh remain unchanged.

No backend/schema/native/provider changes. Actual render→decorate→click tests cover empty URL, A/B/C, duplicates, missing names and stale owner; canonical91 chains90→72. Analyzer cache02150. No live provider or release claims before Root verification.
