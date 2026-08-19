import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const repoRoot=new URL('../../',import.meta.url);
const [version,home,admin,rootStart,mvpStart,ads,elonAdmin,programs,elonChat,vision2,regression,packageText]=await Promise.all([
  readFile(new URL('VERSION.txt',root),'utf8'),
  readFile(new URL('public/index.html',root),'utf8'),
  readFile(new URL('public/admin.html',root),'utf8'),
  readFile(new URL('START-HERE.md',repoRoot),'utf8'),
  readFile(new URL('START-HERE.md',root),'utf8'),
  readFile(new URL('public/ads-center.html',root),'utf8'),
  readFile(new URL('public/elon-page-admin.html',root),'utf8'),
  readFile(new URL('public/my-programs.html',root),'utf8'),
  readFile(new URL('public/elon-chat.js',root),'utf8'),
  readFile(new URL('public/vision2.js',root),'utf8'),
  readFile(new URL('scripts/test-all-regressions.mjs',root),'utf8'),
  readFile(new URL('package.json',root),'utf8'),
]);

assert.equal(version.trim(),'v0.14.323');
assert.match(home,/WEB v0\.14\.323/);
assert.match(admin,/ADMIN v0\.14\.323/);
for(const start of [rootStart,mvpStart]){
  assert.match(start,/เวอร์ชันปัจจุบัน: \*\*v0\.14\.323\*\*/);
  assert.match(start,/patch-ledgers\/v0\.14\.323\.json/i);
}
assert.match(ads,/vision7\.css\?v=014323/);
assert.match(ads,/ads-center\.js\?v=014323/);
assert.match(elonAdmin,/vision7\.css\?v=014323/);
assert.match(elonAdmin,/elon-page-admin\.js\?v=014323/);
assert.match(programs,/vision7\.css\?v=014323/);
assert.match(programs,/my-programs\.js\?v=014323/);
assert.match(elonChat,/ELON-CHAT-CLEAR-001/);
assert.match(vision2,/V2-IMAGE-DECODE-001/);
assert.match(vision2,/V2-WATERMARK-FONT-001/);
assert.match(regression,/readFileSync\('VERSION\.txt'/);
assert.match(regression,/currentReleaseTest/);
assert.doesNotMatch(regression,/test-v01418[7-9]\.mjs|test-v01419[0-2]\.mjs/);
assert.equal(JSON.parse(packageText).scripts['test:v014323'],'node scripts/test-v014323.mjs');
assert.equal(JSON.parse(packageText).scripts['docs:history-check'],'node scripts/test-document-history.mjs');

console.log('v0.14.323 system audit fixes: PASS');
