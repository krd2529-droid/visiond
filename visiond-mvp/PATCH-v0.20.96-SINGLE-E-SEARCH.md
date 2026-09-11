# v0.20.96 — Single E product search action

Each AI concept card now exposes only ค้นหาสินค้า using the existing canonical primary styling. Removed only the card's keep button and its inventory attributes; existing kept E data, generic inventory handlers and all Marketplace search/query/status/dedup/owner behavior remain.

CSS02098 unchanged; JS02155. Actual renderer and click delegation regression plus94 behavior,95 style/mobile gates, standalone70 and canonical96→72 pass. Original Mark RED now shows one action/no keep mutation. Visible/predeploy/diff pass; independent review and production visual verification remain release gates.
