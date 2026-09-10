# VisionD Browser Launcher

This Windows-only, per-user helper opens fixed destinations in isolated Chrome directories. New, pending and view actions open TikTok Login and preserve the same directory. Explicit API consent uses a short-lived one-use handoff issued by the authorized main VisionD session. The helper never reads, copies, exports or logs cookies.

## Secure API handoff (v0.20.71)

The accepted handoff form is `visiond-profile://open?mode=handoff&slot_id=<UUID>&id=<UUID>&ticket=<64 lowercase hex>`. It opens the exact slot directory and reconstructs a fixed HTTPS landing with these values in a fragment. The landing immediately clears the fragment and redeems by same-origin POST. No website session is transferred. The server hashes the capability/state/nonce, validates the original session and grant, and sets a host-only HttpOnly Secure nonce cookie for the provider callback. Final channel/connection/profile writes share a transaction with live authorization and latest-slot checks. Provider consent remains explicit.

From the main page, a saved pending profile can add a new channel or explicitly bind the selected unbound channel. If local storage does not know an already-open slot, the recovery action accepts its UUID as an unverified pending hint; Login Kit must verify identity before binding. Unbound legacy `channel-UUID` directories are preserved; API consent requires an explicitly selected slot and never silently opens a replacement directory. Shop requires the channel's verified slot and uses its own identity namespace.

Install both additive migrations 0095 and 0096 before releasing this code, and upgrade the owned native helper. Main-page focus or manual refresh checks the exact handoff status once; it does not poll or infer successful API consent from browser login. A completed new/restored channel is selected only if the user has not since changed selection.

## Safety boundary

- The custom scheme accepts exactly one of these canonical forms:
  - `visiond-profile://open?mode=existing&channel_id=<UUID>` (legacy view)
  - `visiond-profile://open?mode=existing&channel_id=<UUID>&intent=<view|tiktok|shop>` (legacy unbound channel)
  - `visiond-profile://open?mode=existing&channel_id=<UUID>&slot_id=<UUID>&intent=<view|tiktok|shop>` (authoritatively bound profile)
  - `visiond-profile://open?mode=new&slot_id=<UUID>`
  - `visiond-profile://open?mode=handoff&slot_id=<UUID>&id=<UUID>&ticket=<64 lowercase hex>`
- Windows Shell normalizes those forms to `visiond-profile://open/?...`; the helper accepts that one empty root slash as equivalent, but rejects every other path or extra slash.
- The helper rejects alternate hosts, paths, query order, duplicate/unknown parameters, percent-encoding, fragments, control characters, empty UUIDs and non-UUID identifiers.
- The target origin/path and Chrome switches are compiled into the helper. Callers cannot supply a URL, executable, filesystem path, browser flag, OAuth state/code/token or command.
- Legacy channels without a saved binding reuse `Profiles/channel-<UUID>`. A fresh channel starts in `Profiles/slot-<UUID>`; after a verified Login Kit callback, VisionD returns the same owner-scoped slot with that channel and all later opens reuse the slot directory. The native helper never decides or changes that binding.
- New, pending and view actions open TikTok Login without connecting an API or binding a channel. The main page uses authenticated handoffs for API consent. Historical explicit `tiktok`/`shop` native intents retain their fixed VisionD target only for compatibility; main-page consent no longer dispatches these old intents.

## Install and uninstall

Run `install.ps1` as the current user. It compiles with the bundled Windows .NET Framework C# compiler and registers `visiond-profile` under `HKCU` only if the scheme is absent or already owned by this exact install. No download or administrator access is required.

Run `uninstall.ps1` to remove only the owned protocol registration, executable and marker. It preserves `Profiles` by default so browser sessions are not destroyed accidentally. Delete those profile directories manually only after deciding their retained browser data is no longer needed.

The analyzer shows profile state directly. `+ ช่องใหม่` always requests a fresh slot and opens TikTok Login, including from an already isolated profile. Reopen uses that same pending slot and destination. A pending profile is explicitly labelled login-only and starts no OAuth until the user separately chooses the API action and confirms its preflight. Saved channels open their server-verified slot; an unavailable helper is reported without silently continuing OAuth in the current profile.

Deployment is migration-first: install `0095_tiktok_browser_profile_bindings.sql` then `0096_tiktok_oauth_handoffs.sql` before serving the matching website code. No handoff/binding schema is installed on requests.

Windows/browser protocol prompts do not reliably prove which website initiated a valid custom-scheme request. Close unexpected prompts. Valid requests only open fixed destinations in app-owned profiles. The fixed `--no-default-browser-check` launch flag suppresses Chromium's default-browser check without changing the system default or browser settings; actual dialog disappearance still requires runtime verification. It does not suppress first-run setup or provider consent.
