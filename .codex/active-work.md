# Active patch: Expand channel direction result card

- Status: PATCH_DELIVERED
- Outcome: Make the “ทิศทางช่อง” result card span the full available row instead of half width.
- Preserve: analysis content rendering, hidden legacy data targets, Ranking, desktop and mobile layouts.
- Acceptance: direction card has an explicit full-span class and CSS rule; no JavaScript result target is removed.
- Likely files: TikTok analyzer HTML/CSS, regression test, visible version files.
- Phase: explicit full-span class added; tests and production verification passed.
- Delivery: v0.20.44 pushed to origin/main and verified on visiondonline.com.
