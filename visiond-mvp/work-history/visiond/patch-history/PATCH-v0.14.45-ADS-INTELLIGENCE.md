# VisionD v0.14.45 — Ads Intelligence

Base: v0.14.44 Customer Intelligence

## Added
- Campaign / Creative ad-spend storage by date and platform.
- Boss/Admin Ads Intelligence dashboard: Spend, Attributed Revenue, Orders, Profit, ROAS.
- Campaign cost entry and delete controls.
- Common source normalization for Facebook/Meta, TikTok and Google.
- Purchase events inherit the latest safe first-party attribution within a 30-day window when the backend confirms Paid.
- Customer event raw retention is capped at 90 days by the existing analytics maintenance job.

## Preserved
- Existing daily Facebook ad-cost/profit dashboard remains intact.
- Backend remains authoritative for Purchase.
- No secret/token/query-string payload is stored in attribution.
- No raw Customer Intelligence or Ads Intelligence access is granted to Elon in this patch.

## Usage
Use ad URLs with consistent values such as `utm_source=facebook&utm_campaign=course-rights-aug&utm_content=video-a`. Enter the same Campaign and Creative values in Ads Intelligence so spend can match attributed paid revenue.
