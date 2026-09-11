# v0.20.86 — channel controls and order availability

The single channel-status refresh button is now inside the connected-channel picker with its existing action, live status and contextual Helper selection/recovery. The standalone Chrome heading is removed; empty status space collapses.

VisionD no longer rejects order acquisition because it is before noon. Explicit orders and retained legacy sync paths can reach TikTok at any time; provider errors remain retryable and cached orders stay intact. Date range remains past days, at most90days, and explicit acquisition remains one24-order page per click with existing scope, D1 breaker, revision/lease and atomic write protections. No passive provider call, OAuth change, Helper package rebuild or migration.

Tests: actual-source picker markup/event and09:00 Thai latest-day POST red→green; v85 data integrity/retry/atomic suite and canonical86 regressions. Actual production provider response remains a post-release runtime gate.
