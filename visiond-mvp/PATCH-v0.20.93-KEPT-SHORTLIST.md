# v0.20.93 — Selected products only

Analysis candidates no longer populate the shortlist. Owner-scoped kept resource uses indexed24-row keyset pages; the client automatically loads up to the declared40-row display cap, coalesces requests, caches30seconds by owner/channel, invalidates on inventory mutation and stops stale responses. No manual24-page action and no automatic selection.

Generic analyzed A/B/C explicit keep becomes D; AI E remains E; existing sold-selection A/B/C path remains. Analysis upsert preserves decided kept/discarded grade, source/evidence and review state. No existing data rewrite. Broader independent30-day verification of the legacy sold grade endpoint is not introduced in this scoped patch.

Migration0102 adds only(channel_id,inventory_status,last_seen_at,id) index with runtime parity. Actual SQLite tests cover49-row keysets, query plan, decided upsert and owner-safe grade normalization; actual renderer/loader tests cover zero-kept candidates,40cap/dedup/TTL/invalidation/stale. Canonical93→72, visible/predeploy/diff; JS02152. Root owns migration/release after frozen review.
