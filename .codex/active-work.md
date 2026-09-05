# Active patch: Group TikTok Shop connection actions

- Status: PATCH_DELIVERED
- Outcome: Present reconnect and disconnect as one clearly labelled TikTok Shop management group.
- Preserve: OAuth, account-binding protection, refresh limit, Marketplace, Showcase, and disconnect behavior.
- Acceptance: shared heading; reconnect label is concise; both actions share one row on desktop and stack on mobile; danger styling remains on disconnect.
- Likely files: TikTok analyzer HTML/client/CSS, UI regression test, visible version files.
- Phase: implementation, regression checks, and production verification passed.
- Delivery: v0.20.37 pushed to origin/main and verified on visiondonline.com.
