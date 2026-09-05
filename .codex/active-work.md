# Active patch: Collapse analysis history

- Status: PATCH_DELIVERED
- Outcome: Replace the always-expanded history list with a compact collapsed disclosure.
- Preserve: every saved run, date/provider details, and the existing “เปิดผล” action.
- Acceptance: history is closed by default and resets closed when switching channels; users can expand it on demand; desktop/mobile remain usable.
- Likely files: TikTok analyzer HTML/JS/CSS, regression test, visible version files.
- Phase: collapsed disclosure implemented; tests and production verification passed.
- Delivery: v0.20.45 pushed to origin/main and verified on visiondonline.com.
