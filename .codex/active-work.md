# Active patch: Collapse analysis history

- Status: PATCH_READY
- Outcome: Replace the always-expanded history list with a compact collapsed disclosure.
- Preserve: every saved run, date/provider details, and the existing “เปิดผล” action.
- Acceptance: history is closed by default and resets closed when switching channels; users can expand it on demand; desktop/mobile remain usable.
- Likely files: TikTok analyzer HTML/JS/CSS, regression test, visible version files.
- Phase: collapsed disclosure implemented; history actions, layout, release, and pre-deployment checks passed.
- Delivery: test, review diff, commit only related files, push origin main, verify production.
