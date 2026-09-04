import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requestWorkNotesAI } from '../functions/_work-notes-ai.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [helper, version, admin, index] = await Promise.all([
  read('functions/_work-notes-ai.js'), read('VERSION.txt'), read('public/admin.html'), read('public/index.html'),
]);
assert.match(helper, /gemini-2\.5-flash-lite/);
assert.match(helper, /gemini-flash-latest/);
assert.match(helper, /response\.status !== 404/);
assert.equal(version.trim(), 'v0.14.616');
assert.match(admin, /ADMIN v0\.14\.616/);
assert.match(index, /WEB v0\.14\.616/);

const originalFetch = globalThis.fetch;
const called = [];
globalThis.fetch = async url => {
  called.push(url);
  if (url.includes('gemini-2.5-flash:')) return new Response('{}', { status: 404 });
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'สำเร็จ' }] } }] }), { status: 200 });
};
assert.equal(await requestWorkNotesAI({ GEMINI_API_KEY: 'one' }, 'test'), 'สำเร็จ');
assert.equal(called.length, 2);
assert.match(called[1], /gemini-2\.5-flash-lite/);
globalThis.fetch = originalFetch;

console.log('v0.14.616 Gemini model fallback checks passed');
