# Codex runtime ACL recovery on Windows

## Known incident

This workspace has hit the same Codex runtime failure twice. The visible symptom is that ordinary tool commands fail before the command starts with messages such as:

- `helper_unknown_error: setup refresh had errors`
- `deny ACE failed`
- `SetNamedSecurityInfoW ... error 5`
- `Access is denied`

The confirmed cause on 2026-09-05 was a workspace runtime/cache path owned by `DESKTOP-LJVP0TB\CodexSandboxOffline` instead of the interactive user. The first confirmed failing path was `D:\Data2\visiond\.codex`. A later complete top-level audit also found `.tmp`, `.pnpm-store`, `AGENTS.md`, and `SAFE-BASELINE.md` with stale sandbox ownership.

This is a local Codex sandbox provisioning/ACL problem. It is not a TikTok API failure, Cloudflare failure, application runtime failure, or evidence that a VisionD feature patch is broken.

## Fast diagnosis

Run the read-only checker from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-codex-runtime-acl.ps1
```

The expected owner is the current Windows user. `CodexSandboxUsers` entries in the ACL may be normal; the important failure signal is an item whose **owner** is `CodexSandboxOffline` or another stale sandbox identity.

## Repair scope

Repair only paths reported by the checker. Do not recursively change the owner of the whole repository and do not touch `.git` unless a separate diagnosis proves it is affected.

Open an Administrator PowerShell and run, for each reported path:

```powershell
icacls "D:\Data2\visiond\.codex" /setowner "DESKTOP-LJVP0TB\User" /T /C
```

Repeat only for another explicitly reported runtime/cache directory. For an individual file, omit `/T`.

After repair, rerun the checker and then run a harmless command such as `git status --short`. If setup still fails, inspect the newest files under `C:\Users\User\AppData\Local\Codex\Logs` for `deny ACE failed` and use the exact path named in that log.

## Prevention

- Never copy `.codex`, `.tmp`, or `.pnpm-store` from an old workspace snapshot.
- Never restore those directories from a backup made under a sandbox account.
- Do not use a blanket owner/ACL rewrite over the repository.
- Preserve this note even when runtime caches are recreated.

