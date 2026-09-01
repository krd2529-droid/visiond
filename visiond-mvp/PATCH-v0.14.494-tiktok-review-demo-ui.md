# PATCH v0.14.494 — TikTok review demo UI

- Redesigned the real TikTok Affiliate dashboard to match the submitted service artwork more closely: summary cards, 30-day commission chart, channel comparison, Showcase performance table, A–F badges, and recommendations.
- Added a reviewer-safe demo mode at `/tiktok-analyzer.html?review_demo=1`.
- Demo mode is visibly labelled in Thai as sample data and never claims that TikTok API authorization succeeded.
- Demo controls are read-only, so they cannot modify grades or remove products from a real Showcase.
- The same components render live API data once the creator authorizes the app.

