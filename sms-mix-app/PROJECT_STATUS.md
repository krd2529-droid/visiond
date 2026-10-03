# SMS Mix v0.2.0 — candidate, not released

The supplied v0.1.0 source is preserved separately. This source tree adds VisionD key-only activation, a single current device binding, online entitlement checks before scheduled SMS handoff, and local caption/phone set storage (20 of each). Existing queue states remain fail-closed: PENDING is paused on failed verification; SENDING/UNKNOWN is never automatically retried.

Local candidate verification (2026-10-04): `test-core.ps1` passed 20,027 checks; Gradle `testDebugUnitTest assembleDebug lintDebug` passed 23 Robolectric tests and built a debug APK; lint reported 0 errors and 9 warnings. Server-focused SMS Mix tests passed separately. No physical-device/carrier SMS test, Production migration, product publication, or commercial release has occurred.

The new debug APK is signed with a different certificate from the supplied v0.1.0 APK. An in-place upgrade that preserves the old app's queue and drafts has not been demonstrated. Do not uninstall the old app as a workaround without a separate data-migration decision. A matched source ZIP and APK pair must be built and hash-verified before any delivery.
