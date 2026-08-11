# Patch v0.14.47 — Conversion + Product Demand Intelligence

Date: 2026-08-10
Base: v0.14.46

## Added
- Product-family intelligence: numbered titles such as `ชื่อเดิม ชุดที่ 2`, `3`, `4` are analyzed as one family.
- Inventory origin fields: `premade_stock` vs `demand_driven`; existing/ordinary stock defaults to premade so inventory count is not mistaken for demand.
- Family metrics for unique product views, add-to-cart, checkout, paid orders and revenue.
- Production recommendations: PRODUCE / TEST / HOLD with next sequential series number.
- Customer Journey admin payload no longer includes customer email; display uses minimum necessary identity.

## Decision safeguards
- Existing numbered stock is not evidence of demand by itself.
- Low views are treated as insufficient evidence, not automatic rejection.
- High exposure + low cart rate results in HOLD rather than producing more.
- Demand-driven production requires observed engagement/purchase evidence.

## Next
- Validate on production data.
- Proposed v0.14.48: personalized related-product/interest engine with anonymous + member interest, frequency caps and recommendation measurement.
