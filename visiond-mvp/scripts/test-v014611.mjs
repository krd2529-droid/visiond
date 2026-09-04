import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requestWorkNotesAI } from '../functions/_work-notes-ai.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [helper, expand, presentation, client, html, version] = await Promise.all([
  read('functions/_work-notes-ai.js'),
  read('functions/api/admin/work-notes/expand.js'),
  read('functions/api/admin/work-notes/presentation.js'),
  read('public/work-notes.js'),
  read('public/work-notes.html'),
  read('VERSION.txt'),
]);

assert.match(helper, /GEMINI_API_KEY/);
assert.match(helper, /GEMINI_API_KEY_2/);
assert.doesNotMatch(helper, /OPENAI_API_KEY/);
assert.match(helper, /AbortSignal\.timeout\(45000\)/);
assert.match(helper, /for \(const provider of providers\)/);
assert.match(expand, /requestWorkNotesAI/);
assert.match(expand, /AI เติมเนื้อหาไม่สำเร็จ \(\$\{code\}\)/);
assert.match(presentation, /requestWorkNotesAI/);
assert.match(presentation, /jsonMode: true/);
assert.match(client, /ทำรายการไม่สำเร็จ \(HTTP \$\{response\.status\}\)/);
assert.match(html, /work-notes\.js\?v=014611/);
assert.equal(version.trim(), 'v0.14.611');

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), key: options.headers['x-goog-api-key'] });
  if (calls.length === 1) return new Response('{}', { status: 500 });
  return Response.json({ candidates: [{ content: { parts: [{ text: 'เรียบเรียงสำเร็จ' }] } }] });
};
try {
  const result = await requestWorkNotesAI({ GEMINI_API_KEY: 'first', GEMINI_API_KEY_2: 'second' }, 'prompt');
  assert.equal(result, 'เรียบเรียงสำเร็จ');
  assert.deepEqual(calls.map(call => call.key), ['first', 'second']);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('v0.14.611 resilient Work Notes AI provider checks passed');
