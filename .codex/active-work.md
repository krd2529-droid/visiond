# Active patch: Marketplace selection cannot add to Showcase

- Status: PATCH_READY
- Report: a Marketplace product can be checked, but the add-to-Showcase button remains disabled in production `v0.20.48`.
- Outcome: selected eligible Marketplace products can be submitted to the real TikTok Add Showcase Products API; unavailable TikTok permissions must be explained at the action point instead of looking like a broken button.
- Preserve: channel/account isolation, real TikTok data only, batch limit 20 per API request, per-product TikTok errors, and current Marketplace/Showcase layout.
- Acceptance: reproduce the disabled state; prove its earliest cause; add a regression test; verify enabled/permission-denied/success paths; bump visible patch version; commit and push only related files; verify production assets and UI.
- Root cause: the connected Creator token has Marketplace read permission but no `creator.showcase.write` or `creator.video.write`; the client disabled the button, making its own explanatory click handler unreachable.
- Phase: UX correction and regression gates complete; commit, push, and production verification in progress.
- Delivery: pending.
