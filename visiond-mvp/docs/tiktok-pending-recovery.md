# Pending command recovery (v0.20.79)

Login Kit and Shop continue sharing a channel pending lock to protect the same physical profile. Each saved request now retains its provider and intent. A click on a locked channel performs one coalesced owner/session-bound status read instead of falsely calling cancellation a status check.

- Completed/failed/cancelled/expired exact command: clear only that pending generation and offer a precise next click for the selected action. The extra click preserves genuine popup activation after asynchronous status inspection.
- Pending/claimed: explicitly resume the same non-capability command ID through the original bootstrap. No new issue call or OAuth ticket is created. The existing native durable journal prevents a second Process.Start and can report its previous result.
- Process started/unknown: inspect original window; do not create a replacement. A status read remains available.
- Waiting/no stored command: allow explicit cancellation to install the existing race-safe tombstone before a new attempt; do not assume a late issue failed.

Cancellation has its own labelled action and is available only on pending/waiting results. Backend claim/cancel serialization remains authoritative if the status changes. Errors retain uncertain work. Owner/channel revision and request-object guards prevent stale actions or responses from changing another selection.

Helper is a loopback listener, not a background backend queue poller. This change does not assert liveness from helper registration or navigation, does not grant provider consent and does not change Login Kit v78 scope gating, Shop identity/state, native code or the installed package. Actual installed-helper/isolated Chrome callback testing remains a delivery gate.
