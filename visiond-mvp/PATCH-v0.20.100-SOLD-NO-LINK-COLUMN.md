# v0.20.100 — Sold products without link column

Removed only the final product-link header/cell in the sold-products table. Product ID/order-count positions remain unchanged; shortlist action appends as column7 after six base columns. Other tables and global link controls are untouched.

Blank URL was already accepted by v91 and remains so; no fabricated links, persistence/schema/grade changes. Actual renderer/action tests cover alignment, blankURL payload, A/B/C, duplicate/placeholder/owner. Original REDgreen, full canonical100→72/visible/predeploy/diff pass. JS02158/CSS02099. Independent review and production verification pending.
