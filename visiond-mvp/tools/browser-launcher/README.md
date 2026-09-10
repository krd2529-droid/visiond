# VisionD Browser Launcher

This Windows-only, per-user helper opens fixed destinations in isolated Chrome directories. Normal v72 transport does not depend on Chrome custom-scheme discovery. View opens TikTok Login without issuing OAuth; Connect/new uses official consent. The helper never reads, copies, exports or logs cookies.

## Paired local transport (v0.20.72)

Install starts an owned singleton loopback listener on a random stable port, and registers that exact executable under the current user's Run key. The GUI-subsystem executable does not create a startup console. Initial setup is a separate, explicit `VisionDBrowserLauncher.exe --pair` action: compare the eight-character code in its local message with the HTTPS VisionD page, check the match box, then click `ยืนยันผูกตัวช่วยเครื่องนี้`. Never approve an unsolicited pairing link. Installation and tests do not open pairing/provider windows automatically.

The helper generates a 256-bit shared secret, stores it using DPAPI CurrentUser with a restricted Transport-directory ACL, and sends it only to the fixed VisionD HTTPS endpoint. The server encrypts the stored key with owner/helper/version-associated data. Pairing requires an authenticated original session and explicit one-use confirmation. `--pair-replace` stages a separate DPAPI candidate, names/revokes the exact old helper on confirmation, and promotes the candidate only after an authenticated result; cancellation/network loss preserves the old local configuration and rerunning resumes the same candidate.

A genuine Analyzer click synchronously opens a harmless same-origin `noopener,noreferrer` bootstrap, then the Analyzer alone performs the authorized command POST. The bootstrap only reads an already-created command belonging to the exact current user/session and its authoritative paired port; standalone links cannot create commands. The browser handles only a non-capability command UUID, never the native ticket or helper secret. The bootstrap navigates to `http://127.0.0.1:<paired port>/launch?command_id=<UUID>`. All fetch headers and bodies have abort/deadline guards; bootstrap resolution stops after at most eight attempts within 25 seconds. The listener claims authoritative profile fields over TLS with purpose-separated nonce/HMAC authentication. A fake local listener can see an ID or cause timeout, but cannot claim a ticket or forge server status. Same-Windows-user full compromise is outside this boundary; DPAPI is not executable attestation.

Before Process.Start, the helper durably records an ambiguous journal entry. Repeated requests report the saved outcome without launching twice. The backend rechecks the original live session, grants, immutable binding, head and expiry before returning any ticket. Main status polling is same-origin, indexed and bounded to eight attempts (about 24 seconds), then manual/focus refresh only. `process_started` means the helper started Chrome, not that login or API consent succeeded. Cancellation serializes with claim and leaves a 24-hour bounded-cleanup tombstone so a slow bootstrap cannot resurrect a cancelled request. Claimed/ambiguous live requests cannot be cancelled into a duplicate launch. Temporary tabs attempt self-close; if Chrome refuses, they explain that the tab may be closed, never closing the provider profile.

## Direct API handoff (v0.20.72)

The current handoff form is `visiond-profile://open?mode=handoff&profile_kind=<slot|channel>&slot_id=<UUID>&id=<UUID>&ticket=<64 lowercase hex>`. The server derives the exact directory kind and identifier. The helper reconstructs a fixed HTTPS fragment landing, which immediately clears the fragment and redeems by same-origin POST with the same kind. No website session is transferred. Hashed capability/state/nonce, original session/grant checks and the host-only HttpOnly Secure nonce remain enforced at callback and final atomic persistence. The old kindless handoff parser remains compatible with slot profiles only.

Click Connect to start official consent directly. Bound channels reuse their stored immutable directory kind; unbound existing channels use their deterministic `channel-UUID` directory. A requested Shop connection first verifies Login Kit if necessary, then rotates the same guarded flow to new Shop state/nonce inside the binding transaction and redirects to official Shop consent. Original expiry/session/grant/head remain unchanged. Shop uses its own identity namespace. `+ ช่องใหม่` starts real Login Kit consent in a server-generated fresh slot; there is no intermediate dialog, copy step or UUID input.

Install migrations 0095–0098 in order and upgrade/pair the owned helper before releasing this code. Focus/manual refresh checks only the selected outstanding request (or current new-channel request). Multiple profiles retain separate pending requests; repeated same-channel clicks do not supersede them. Returned channels are selected only while the original UI revision remains current. The scheme parser below remains a strict legacy compatibility surface, not the normal website transport.

## Safety boundary

- The custom scheme accepts exactly one of these canonical forms:
  - `visiond-profile://open?mode=existing&channel_id=<UUID>` (legacy view)
  - `visiond-profile://open?mode=existing&channel_id=<UUID>&intent=<view|tiktok|shop>` (legacy unbound channel)
  - `visiond-profile://open?mode=existing&channel_id=<UUID>&slot_id=<UUID>&intent=<view|tiktok|shop>` (authoritatively bound profile)
  - `visiond-profile://open?mode=new&slot_id=<UUID>`
  - `visiond-profile://open?mode=handoff&slot_id=<UUID>&id=<UUID>&ticket=<64 lowercase hex>`
  - `visiond-profile://open?mode=handoff&profile_kind=<slot|channel>&slot_id=<UUID>&id=<UUID>&ticket=<64 lowercase hex>`
- Windows Shell normalizes those forms to `visiond-profile://open/?...`; the helper accepts that one empty root slash as equivalent, but rejects every other path or extra slash.
- The helper rejects alternate hosts, paths, query order, duplicate/unknown parameters, percent-encoding, fragments, control characters, empty UUIDs and non-UUID identifiers.
- The target origin/path and Chrome switches are compiled into the helper. Callers cannot supply a URL, executable, filesystem path, browser flag, OAuth state/code/token or command.
- Legacy channels without a saved binding reuse `Profiles/channel-<UUID>`. A fresh channel starts in `Profiles/slot-<UUID>`; after a verified Login Kit callback, VisionD returns the same owner-scoped slot with that channel and all later opens reuse the slot directory. The native helper never decides or changes that binding.
- New, pending and view actions open TikTok Login without connecting an API or binding a channel. The main page uses authenticated handoffs for API consent. Historical explicit `tiktok`/`shop` native intents retain their fixed VisionD target only for compatibility; main-page consent no longer dispatches these old intents.

## Install and uninstall

Run `install.ps1` as the current user. It compiles with the bundled Windows .NET Framework C# compiler and registers `visiond-profile` under `HKCU` only if the scheme is absent or already owned by this exact install. No download or administrator access is required.

Run `uninstall.ps1` to stop only the verified owned listener and remove its exact owned Run entry, protocol registration, executable and marker. It preserves Profiles and DPAPI Transport configuration for reinstall. It never stops unrelated processes or deletes browser data. Replacing the paired helper explicitly revokes its previous backend key.

Old `?connect=` links still resolve the exact owned channel and display a notice to click its Connect button. Page-load hints do not authorize an unsolicited new flow. Optional View opens TikTok Login in the stored directory kind. Existing pending and legacy directories are preserved; no data is copied, deleted or silently assigned to a channel.

Deployment is migration-first: install `0095_tiktok_browser_profile_bindings.sql`, `0096_tiktok_oauth_handoffs.sql`, `0097_tiktok_direct_profile_login.sql`, then `0098_browser_launcher_transport.sql` before serving matching website code. Migrations use tracking and must not be applied on requests. Release remains gated on actual already-running Chrome popup/loopback behavior, owned install/listener verification and explicit human pairing; synthetic tests alone do not prove delivery.

Windows/browser protocol prompts do not reliably prove which website initiated a valid custom-scheme request. Close unexpected prompts. Valid requests only open fixed destinations in app-owned profiles. The fixed `--no-default-browser-check` launch flag suppresses Chromium's default-browser check without changing the system default or browser settings; actual dialog disappearance still requires runtime verification. It does not suppress first-run setup or provider consent.
