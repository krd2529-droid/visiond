# Active patch: Restore manual C product entry

- Status: PATCH_READY
- Report: `เพิ่มสินค้าทดสอบ C ด้วยตนเอง` is separated from the visible `ลิสต์คัดสินค้าของฉัน`, so the control appears missing in the workflow shown by the user.
- Outcome: place the manual C-product form and its explanation directly above the selected-product list.
- Preserve: existing save endpoint, duplicate prevention, C grade assignment, 3-day review scheduling, latest analysis rendering, and permanent inventory.
- Acceptance: one unique manual form; visible in `ลิสต์คัดสินค้าของฉัน`; submitting still saves as C; responsive layout and existing TikTok regressions pass.
- Phase: implementation and verification complete.
- Verification: manual-C placement, hidden-history, Marketplace separation, Showcase readiness, mobile frontend, predeploy, and diff checks passed. Legacy `test-v014566.mjs` remains stale on a pre-existing grade-label literal unrelated to this patch.
- Delivery: pending commit, push, and production verification.
