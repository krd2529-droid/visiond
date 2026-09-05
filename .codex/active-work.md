# Active patch: Marketplace selection cannot add to Showcase

- Status: PATCH_BLOCKED
- Report: a Marketplace product can be checked, but the add-to-Showcase button remains disabled in production `v0.20.48`.
- Outcome: selected eligible Marketplace products can be submitted to the real TikTok Add Showcase Products API; unavailable TikTok permissions must be explained at the action point instead of looking like a broken button.
- Preserve: channel/account isolation, real TikTok data only, batch limit 20 per API request, per-product TikTok errors, and current Marketplace/Showcase layout.
- Acceptance: reproduce the disabled state; prove its earliest cause; add a regression test; verify enabled/permission-denied/success paths; bump visible patch version; commit and push only related files; verify production assets and UI.
- Root cause: the connected Creator token has Marketplace read permission but no `creator.showcase.write` or `creator.video.write`; the client disabled the button, making its own explanatory click handler unreachable.
- Phase: UX correction, regression gates, push, and production verification complete.
- Delivered code: `v0.20.49`, commit `c7d7b81b`, verified on `https://visiondonline.com` on 2026-09-05.
- External blocker: automatic add cannot succeed until the TikTok Shop app is approved for `creator.showcase.write` or `creator.video.write` and the Creator account is reauthorized so the new token contains that scope.
- Next action: enable the Write scope in TikTok Shop Partner Center, remove existing app access, reconnect the same channel, then re-run the selected-product add flow.
