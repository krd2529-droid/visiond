# v0.20.102 — remove creator-density product column

Removed the `ความหนาแน่นครีเอเตอร์` header and matching product-row cell from Open Collaboration Marketplace results. Product and shop modes now each render nine aligned columns; sales, commission, growth, product link, Showcase and shortlist actions remain intact.

Provider normalization, API payloads and stored snapshots remain unchanged. The focused actual-render regression covers populated and empty product/shop results, verifies nine headers/cells/colspan and proves the density presentation and exclusive CSS are absent. WEB/ADMIN/analyzer v0.20.102, JS02160 and CSS02101. Release pending independent review.
