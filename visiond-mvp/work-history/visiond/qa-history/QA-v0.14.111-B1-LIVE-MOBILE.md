# QA v0.14.111 — B1 Live Mobile Operations

## Automated
- Restricted APK CORS/OPTIONS and error classification.
- Atomic unpaid-order cancellation and one-time stock release.
- Product edit plus safe delete/hide.
- Bot readiness/start/stop and LINE/Facebook handoff.
- Persistent, deduplicated and paginated action queue with urgent pinning and reminder intervals.
- Source/APK version, archive and signature integrity.

## Redmi Note 14 Pro+ 5G — pending Boss smoke
1. Install v1.0.10 and activate with the real V Easy key.
2. Confirm online/offline error text and session recovery.
3. Cancel an unpaid order twice; stock returns once. Confirm paid order cannot cancel.
4. Edit/save a product; delete unused product; verify sold product is hidden.
5. Start bot, switch LINE/Facebook repeatedly, stop bot.
6. Fill urgent and normal actions beyond one page; verify pages, badge, pull-forward and reminder sound.
7. Verify Back, QR camera, lock/reopen and privacy on lock screen.

## Truthful native boundary
Nitron 1.3 currently provides the action center and polling while the V Easy process remains alive. It does not yet provide a true Android foreground service, cross-app overlay, or push notification after Android kills the process. The server bot continues working independently.
