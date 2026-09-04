import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [client, page, version, admin, index] = await Promise.all([
  read('public/work-notes.js'), read('public/work-notes.html'), read('VERSION.txt'), read('public/admin.html'), read('public/index.html'),
]);
assert.match(client, /if\(dialog\?\.open\)/);
assert.match(client, /target\.textContent=text/);
assert.match(client, /ensurePptxLibrary/);
assert.match(client, /data-pptx-retry|dataset\.pptxRetry/);
assert.match(client, /\$\('#pptOptions'\)\.showModal\(\);const button=/);
assert.match(page, /pptxgen\.min\.js\?v=014617/);
assert.match(page, /work-notes\.js\?v=014617/);
assert.equal(version.trim(), 'v0.14.617');
assert.match(admin, /ADMIN v0\.14\.617/);
assert.match(index, /WEB v0\.14\.617/);
console.log('v0.14.617 PowerPoint loader and in-dialog status checks passed');
