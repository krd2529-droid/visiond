import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/course-draft-first-ep.js', import.meta.url), 'utf8');

assert.ok(source.includes('class="episode-card-head"'), 'EP must have a non-interactive heading');
assert.ok(source.includes('class="episode-card-body"'), 'EP fields must always be rendered');
assert.ok(!source.includes('collapseEpisodeCards'), 'collapse-all control must not exist');
assert.ok(!source.includes('episode-card-toggle'), 'per-EP collapse control must not exist');
assert.ok(!source.includes("body.hidden"), 'EP body must not be hidden by script');
assert.ok(!source.includes('aria-expanded'), 'EP must not expose obsolete collapse state');

console.log('PASS v0.14.285: EP forms remain open and contain no collapse controls');
