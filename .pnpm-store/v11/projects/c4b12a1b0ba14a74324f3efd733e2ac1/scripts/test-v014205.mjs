import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [version, index, admin, v12, protocol, roadmap, ledger] = await Promise.all([
  read('VERSION.txt'), read('public/index.html'), read('public/admin.html'),
  read('public/v12-connect.html'), read('JARVIS-PATCH-PROTOCOL.md'),
  read('VISIOND-ROADMAP.md'), read('patch-ledgers/v0.14.205.json')
]);

assert.equal(version.trim(), 'v0.14.205');
assert.match(index, /WEB v0\.14\.205/);
assert.match(admin, /ADMIN v0\.14\.205/);
assert.match(v12, /v0\.14\.205/);
for (const required of [
  'Continuous frontend Button/Event coverage rule',
  'loading/disabled/success/error',
  'desktop, Android-size and iPhone-size',
  'focused automated test',
  'cannot be closed, committed or marked `DONE-VERIFIED`'
]) assert.ok(protocol.includes(required), `protocol missing: ${required}`);
for (const required of ['Button/Event coverage', 'focused automated test', 'Event Roadmap']) {
  assert.ok(roadmap.includes(required), `roadmap missing: ${required}`);
}
const parsed = JSON.parse(ledger);
assert.equal(parsed.patch, 'v0.14.205');
assert.equal(parsed.tasks.every(task => task.status === 'DONE-VERIFIED'), true);
console.log('v0.14.205 continuous frontend Button/Event coverage: PASS');
