import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/course-draft-first-ep.js', import.meta.url), 'utf8');

assert.ok(source.includes('id="addEpisodeCard"'), 'visible add EP button is required');
assert.ok(source.includes("renderCount(renderedCount+1"), 'add EP must append one card');
assert.ok(source.includes("countInput.value=next"), 'visible EP count must stay synchronized');
assert.ok(source.includes("renderedCount>=200"), 'add EP must keep the course limit');
assert.ok(source.includes("querySelector('[data-field=\"title\"]')?.focus()"), 'new EP title must receive focus');
assert.ok(!source.includes('collapseEpisodeCards'), 'collapse controls must remain removed');

console.log('PASS v0.14.286: visible add EP button appends and focuses a new EP');
