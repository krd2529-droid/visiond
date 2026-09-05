# Active patch: Prevent TikTok Shop account reassignment

- Status: PATCH_READY
- Outcome: Keep a TikTok Shop Creator account on its original VisionD channel when the same TikTok session is used while connecting another channel.
- Preserve: reconnecting the same channel, reconnecting an explicitly disconnected account, OAuth state checks, scopes, Showcase and Marketplace data.
- Acceptance: an active account cannot move across channels; callback reports the original channel; UI tells the user to switch TikTok accounts; original binding remains unchanged; different accounts can still connect.
- Likely files: TikTok Shop OAuth persistence/callback, analyzer OAuth message, focused regression test, visible version files.
- Phase: root cause reproduced; implementation and regression checks passed; ready to commit and deploy.
- Delivery: test, review diff, commit only related files, push origin main, verify production.
