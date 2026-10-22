# VisionD Social Work desktop 0.2.2

An original Windows desktop app for drafting and reviewing work for YouTube, TikTok, and Facebook Page channels. Each workspace has its own local jobs and audit trail. OpenAI prepares text drafts through the official Responses API. A reviewer must approve the exact text before the app records a local prepared package.

No social platform connector or publishing action exists in this version. `prepared_locally` means the approved text was recorded in the app's local database; it does not mean a post was published or scheduled.

## Install on Windows

Run `dist/installer/VisionD-Social-Work-Setup-0.2.2.exe` and follow the per-user installer. This build is **unsigned**, so Windows may show a publisher warning. Do not override a warning unless you trust the file and its source. The installer supports uninstall and later same-app upgrades. It keeps local drafts in Electron's user-data directory (`visiond-social-work-desktop/social-work.db`), outside the installation folder; uninstall does not erase that database. Back it up separately if you need to remove your data. The app is still a local drafting/review tool, not a live social publisher.

To enable AI, create your own OpenAI API key in the OpenAI developer dashboard. In Windows, open **Edit environment variables for your account**, add a user variable named `OPENAI_API_KEY`, enter the value, then fully close and reopen the app. Do not share the key in chat or put it in a project file. Windows user environment variables are stored by Windows for that account; use a protected Windows account. The app checks only key *presence* on startup. In Settings, click **ทดสอบการตอบจาก OpenAI** to make one real, small Responses API request; a successful response is shown as verified only for that running session. This call may incur API usage. No API key or response is stored by the test, and the key is never sent to the renderer.

This machine had no `OPENAI_API_KEY` when this release was built, so a live OpenAI response has **not** been verified here. A ChatGPT subscription is separate from OpenAI API access.

## Run from source

Requires Windows and Node.js 24 or an Electron runtime with `node:sqlite` support. From this directory:

```powershell
npm install
npm start
```

The API key must be available to the app process. It is never saved in the app database or passed to the renderer. `OPENAI_MODEL` optionally overrides the default `gpt-5-mini` model. AI generation incurs API usage; local manual drafting and review work without a key.

## Windows folder package

```powershell
npm run package:win
```

Open `dist/visiond-social-work-win32-x64-0.2.2/VisionD Social Work.exe`. Keep the entire folder together; the EXE is not standalone. The normal installer above is preferable for regular use. Set `OPENAI_API_KEY` in the launch environment for AI drafting. The package copies only this app's source and the installed Electron runtime. It does not include any VisionD website files or third-party app assets.

Local state is stored in Electron's user-data directory as `social-work.db`. On restart, interrupted generating/preparing jobs are marked failed and never resumed automatically. Retry and approval are manual. Jobs, activity events, and workspace lists use 24-item keyset pages with SQLite indexes.

## Verify

`npm test` checks text approval snapshots, local media reselection resetting approval, publication-manifest fail-closed guards, duplicate/restart handling, pagination/index use, request dedup/cache invalidation, and OpenAI request shape with local fake responses. No live social account or OpenAI call is made by tests.

## Social account connection prerequisites

The requested final workflow is **real publishing only after explicit approval**. You chose to select local media files manually before approval. This version can select one local video for a YouTube/TikTok job or up to 10 local video/image files for a Facebook Page job, hash them with SHA-256 in the main process, and display file name/type/size/hash in the job detail. Changing or clearing files resets the current text approval. The files stay on your computer; they are not uploaded or copied into the database. The local database stores their paths and metadata, but the renderer sees only name/type/size/hash. The existing approval button approves **text only**, not a publish-ready package. Final publishing approval will need to bind the exact text, unchanged media hashes, authorized target account, and privacy/settings after the platforms are connected.

All three platform statuses remain **disconnected**. This release has no OAuth login, token storage, upload, posting, scheduling, or remote result verification. Creating a workspace is not connecting an account, and `prepared_locally` is not published. An internal-only publication boundary rejects text-only jobs, requires a complete approved manifest and matching authorized account, reserves a one-shot idempotency key before any future connector call, and never auto-retries an uncertain outcome; no renderer IPC or production connector invokes it. YouTube upload requires the Google OAuth upload scope; TikTok Direct Post requires an approved `video.publish` scope, user authorization, and app audit for public visibility. Facebook Page permissions and app review must be verified against the specific Meta app/Page before integration. The app will not infer these grants from a screenshot or use saved account passwords.
