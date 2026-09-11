# v0.20.97 — Refresh does not force result scrolling

Shared result rendering no longer moves the viewport. Saved/empty channel restore and passive reload remain at the browser's normal position without hash, focus or scroll-restoration overrides.

Explicit successful channel analysis retains exactly one smooth result scroll after current-owner publication. Separate explicit AI recommendation/Marketplace navigation remains unchanged.

Actual renderer/publication regression covers passive saved/empty0, explicit1, follow-up0 and stale/failure0. Original Mark REDgreen, v89/70 and canonical97→72, visible/predeploy/diff pass. JS02156/CSS02098; no backend/data/provider changes. Independent review and production verification remain release gates.
