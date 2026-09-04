import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requestWorkNotesAI } from '../functions/_work-notes-ai.js';

const helper = await readFile(new URL('../functions/_work-notes-ai.js', import.meta.url), 'utf8');
assert.match(helper, /Promise\.any\(attempts\)/);
assert.match(helper, /new AbortController\(\)/);
assert.match(helper, /20000/);
assert.doesNotMatch(helper, /45000/);

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (_url, options) => {
  calls.push(options.headers['x-goog-api-key']);
  if (options.headers['x-goog-api-key'] === 'slow') {
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  }
  return Response.json({ candidates: [{ content: { parts: [{ text: 'สำเร็จจากช่องเร็ว' }] } }] });
};
try {
  const result = await requestWorkNotesAI({ GEMINI_API_KEY: 'slow', GEMINI_API_KEY_2: 'fast' }, 'prompt');
  assert.equal(result, 'สำเร็จจากช่องเร็ว');
  assert.deepEqual(calls.sort(), ['fast', 'slow']);
} finally {
  globalThis.fetch = originalFetch;
}

assert.equal((await readFile(new URL('../VERSION.txt', import.meta.url), 'utf8')).trim(), 'v0.14.613');
console.log('v0.14.613 parallel Gemini race and timeout checks passed');
