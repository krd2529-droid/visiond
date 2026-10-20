# VisionD Social Work desktop

An original Windows desktop app for drafting and reviewing work for YouTube, TikTok, and Facebook Page channels. Each workspace has its own local jobs and audit trail. OpenAI prepares text drafts through the official Responses API. A reviewer must approve the exact text before the app records a local prepared package.

No social platform connector or publishing action exists in this version. `prepared_locally` means the approved text was recorded in the app's local database; it does not mean a post was published or scheduled.

## Run

Requires Windows and Node.js 24 or an Electron runtime with `node:sqlite` support. From this directory:

```powershell
npm install
$env:OPENAI_API_KEY = '<your API key>'
npm start
```

The API key must be available to the app process. It is never saved in the app database or passed to the renderer. `OPENAI_MODEL` optionally overrides the default `gpt-5-mini` model. A ChatGPT subscription is separate from OpenAI API access. AI generation incurs API usage; local manual drafting and review work without a key.

## Windows folder package

```powershell
npm run package:win
```

Open `dist/visiond-social-work-win32-x64-0.1.2/VisionD Social Work.exe`. Keep the entire folder together; the EXE is not standalone. Set `OPENAI_API_KEY` in the launch environment for AI drafting. The package copies only this app's source and the installed Electron runtime. It does not include any VisionD website files or third-party app assets.

Local state is stored in Electron's user-data directory as `social-work.db`. On restart, interrupted generating/preparing jobs are marked failed and never resumed automatically. Retry and approval are manual. Jobs, activity events, and workspace lists use 24-item keyset pages with SQLite indexes.

## Verify

`npm test` checks approval snapshots, edits resetting approval, restart recovery, pagination/index use, request dedup/cache invalidation, and the OpenAI request shape with a local fake response. No live social account or OpenAI call is made by tests.
