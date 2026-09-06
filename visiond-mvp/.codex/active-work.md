# Active patch: sales-driven shortlist grades

- Event: PATCH_TESTED
- Outcome: สินค้าที่เพิ่มจากตารางยอดขายเข้า shortlist ด้วย A/B/C ตามยอดขาย 30 วัน; D ใช้เมื่อยอดเป็นศูนย์
- Preserve: manual/Marketplace selections remain D, discarded products remain F
- Acceptance: A >=30, B 16-29, C 1-15, D 0; existing sold selections reconcile on page load
- Phase: implementation and 7 related regressions PASS; awaiting commit/push
- Files: API handler, TikTok analyzer client/HTML, focused regressions
