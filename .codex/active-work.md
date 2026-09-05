# Active patch: Hide redundant selected-channel setup

- Status: PATCH_DELIVERED
- Outcome: Remove the current-channel heading, name field, link field, and save button while an existing channel is selected.
- Preserve: reveal those controls when "+ ช่องใหม่" is used so additional accounts can still be created; keep analysis controls and API workflows.
- Acceptance: existing-channel view omits the pictured setup block; new-channel view still supports name/link creation; analysis remains functional.
- Likely files: TikTok analyzer client/CSS, regression test, visible version files.
- Phase: implementation, regression checks, and production verification passed.
- Delivery: v0.20.40 pushed to origin/main and verified on visiondonline.com.
