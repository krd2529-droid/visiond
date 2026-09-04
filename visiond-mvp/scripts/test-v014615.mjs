import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [endpoint, client, page, version, admin, index] = await Promise.all([
  read('functions/api/admin/work-notes/expand.js'),
  read('public/work-notes.js'),
  read('public/work-notes.html'),
  read('VERSION.txt'),
  read('public/admin.html'),
  read('public/index.html'),
]);

assert.match(endpoint, /CREATE TABLE IF NOT EXISTS work_note_ai_jobs/);
assert.match(endpoint, /ctx\.waitUntil\(runJob\(ctx\.env, id, prompt\)\)/);
assert.match(endpoint, /status: 'queued', job_id: id/);
assert.match(endpoint, /export async function onRequestGet/);
assert.match(endpoint, /deadlineMs: 25000/);
assert.match(client, /waitForExpansion=async id/);
assert.match(client, /expand\?job=/);
assert.match(client, /attempt<50/);
assert.match(page, /work-notes\.js\?v=014615/);
assert.equal(version.trim(), 'v0.14.615');
assert.match(admin, /ADMIN v0\.14\.615/);
assert.match(index, /WEB v0\.14\.615/);

console.log('v0.14.615 asynchronous Work Notes AI job checks passed');
