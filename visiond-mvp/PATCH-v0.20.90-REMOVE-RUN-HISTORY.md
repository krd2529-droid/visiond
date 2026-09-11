# v0.20.90 — Remove analysis history UI

Removed the loaded-run count block, historical run buttons and load-older action, including their UI-only state and handlers. Latest overview result and v89 truthful empty scaffold remain owner-scoped. Stored history/API, sidebar channel count, inventory pagination, Showcase, OAuth, Helper and order acquisition are unchanged.

Actual multirun selection must append no history DOM; v89 saved/empty/late-response tests remain. D1 evergreen keeps backend run pagination and inventory/channel pagination assertions. Version90/cache02149; no backend/schema/native package change. Production delivery remains Root-owned after independent review.
