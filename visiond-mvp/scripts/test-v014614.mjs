import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requestWorkNotesAI } from '../functions/_work-notes-ai.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [helper, expand, presentation, client, page, version, admin, index] = await Promise.all([
  read('functions/_work-notes-ai.js'),
  read('functions/api/admin/work-notes/expand.js'),
  read('functions/api/admin/work-notes/presentation.js'),
  read('public/work-notes.js'),
  read('public/work-notes.html'),
  read('VERSION.txt'),
  read('public/admin.html'),
  read('public/index.html'),
]);

assert.match(helper, /WORK_NOTES_GEMINI_MODEL/);
assert.match(helper, /thinkingConfig:\s*\{ thinkingBudget: 0 \}/);
assert.match(helper, /deadlineMs = 9000/);
assert.match(helper, /Promise\.race\(\[Promise\.any\(attempts\), deadline\]\)/);
assert.match(expand, /maxTokens: 2200/);
assert.match(presentation, /maxTokens: 2200/);
assert.match(expand, /AI_DEADLINE[\s\S]*\}, 504\)/);
assert.match(presentation, /AI_DEADLINE[\s\S]*\}, 504\)/);
assert.match(client, /\[502,503,504\]\.includes\(response\.status\)/);
assert.match(page, /work-notes\.js\?v=014614/);
assert.equal(version.trim(), 'v0.14.614');
assert.match(admin, /ADMIN v0\.14\.614/);
assert.match(index, /WEB v0\.14\.614/);

const originalFetch = globalThis.fetch;
globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
  options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
});
const started = Date.now();
await assert.rejects(
  requestWorkNotesAI({ GEMINI_API_KEY: 'one', GEMINI_API_KEY_2: 'two' }, 'test', { deadlineMs: 30 }),
  /AI_DEADLINE/,
);
assert.ok(Date.now() - started < 500, 'global deadline must settle even when both providers hang');
globalThis.fetch = originalFetch;

console.log('v0.14.614 Work Notes AI hard-deadline checks passed');
