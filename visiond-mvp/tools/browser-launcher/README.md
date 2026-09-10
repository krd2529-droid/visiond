# VisionD Browser Launcher

This Windows-only, per-user helper opens a fixed destination in an isolated Chrome user-data directory. A new or pending slot opens `https://www.tiktok.com/login` so Chrome can retain that profile's TikTok session; a saved channel opens the ordinary `https://visiondonline.com/tiktok-analyzer` page. The helper never reads, copies, exports or logs cookies.

## Safety boundary

- The custom scheme accepts exactly one of these canonical forms:
  - `visiond-profile://open?mode=existing&channel_id=<UUID>` (legacy view)
  - `visiond-profile://open?mode=existing&channel_id=<UUID>&intent=<view|tiktok|shop>` (legacy unbound channel)
  - `visiond-profile://open?mode=existing&channel_id=<UUID>&slot_id=<UUID>&intent=<view|tiktok|shop>` (authoritatively bound profile)
  - `visiond-profile://open?mode=new&slot_id=<UUID>`
- Windows Shell normalizes those forms to `visiond-profile://open/?...`; the helper accepts that one empty root slash as equivalent, but rejects every other path or extra slash.
- The helper rejects alternate hosts, paths, query order, duplicate/unknown parameters, percent-encoding, fragments, control characters, empty UUIDs and non-UUID identifiers.
- The target origin/path and Chrome switches are compiled into the helper. Callers cannot supply a URL, executable, filesystem path, browser flag, OAuth state/code/token or command.
- Legacy channels without a saved binding reuse `Profiles/channel-<UUID>`. A fresh channel starts in `Profiles/slot-<UUID>`; after a verified Login Kit callback, VisionD returns the same owner-scoped slot with that channel and all later opens reuse the slot directory. The native helper never decides or changes that binding.
- Opening a new or pending slot only opens TikTok Login. It does not connect an API, bind a channel, transfer the main browser's VisionD session, choose an account, bypass provider eligibility or grant consent. Existing channel actions still open the ordinary VisionD page and retain the verified preflight/consent flow.

## Install and uninstall

Run `install.ps1` as the current user. It compiles with the bundled Windows .NET Framework C# compiler and registers `visiond-profile` under `HKCU` only if the scheme is absent or already owned by this exact install. No download or administrator access is required.

Run `uninstall.ps1` to remove only the owned protocol registration, executable and marker. It preserves `Profiles` by default so browser sessions are not destroyed accidentally. Delete those profile directories manually only after deciding their retained browser data is no longer needed.

The analyzer shows profile state directly. `+ ช่องใหม่` always requests a fresh slot and opens TikTok Login, including from an already isolated profile. Reopen uses that same pending slot and destination. A pending profile is explicitly labelled login-only and starts no OAuth until the user separately chooses the API action and confirms its preflight. Saved channels open their server-verified slot; an unavailable helper is reported without silently continuing OAuth in the current profile.

Deployment is migration-first: install `0095_tiktok_browser_profile_bindings.sql` before serving the matching website code. The app intentionally fails the profile workflow closed when its owner-scoped binding schema is unavailable; it does not create or alter this schema on a request.

Windows/browser protocol prompts do not reliably prove which website initiated a valid custom-scheme request. Do not select a browser-wide “always allow” option. Close unexpected prompts; even a valid request can only create/reopen an app-owned Chrome profile and open either the fixed TikTok Login page for a pending slot or the fixed ordinary VisionD page for a saved channel, but repeated unwanted windows remain a residual nuisance risk.
