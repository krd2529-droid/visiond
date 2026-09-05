# Active patch: Centralize channel connections in settings

- Status: PATCH_DELIVERED
- Report: the analysis view still offers a direct reconnect/OAuth action when Showcase permissions are missing.
- Outcome: all TikTok/TikTok Shop connection actions remain only in view 1; view 2 shows status and a navigation button back to settings.
- Preserve: permission detection, Marketplace search/add behavior, connection controls in settings, and selected channel state.
- Acceptance: analysis permission UI contains no OAuth link; its button switches to settings and focuses the connection panel; focused permission, view, mobile, and predeploy checks pass.
- Phase: implementation, current permission, Marketplace, mobile, syntax, predeploy, deployment, and production asset checks pass. Legacy `test-v014501.mjs` remains stale against the current v0.20.49 implementation and is outside this patch.
- Delivery: commit `d79cde3d` pushed to `origin/main`; production serves the settings-only connection flow through assets `02055` (verified 2026-09-05).
