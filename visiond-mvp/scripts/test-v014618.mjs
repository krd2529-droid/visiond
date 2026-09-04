import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [bundle, client, page, version, admin, index, bundleStat] = await Promise.all([
  read('public/vendor/pptxgen.min.js'), read('public/work-notes.js'), read('public/work-notes.html'),
  read('VERSION.txt'), read('public/admin.html'), read('public/index.html'),
  stat(new URL('../public/vendor/pptxgen.min.js', import.meta.url)),
]);
assert.ok(bundleStat.size > 400000, 'browser bundle must include its dependencies');
assert.match(bundle, /PptxGenJS/);
assert.match(bundle, /JSZip/);
assert.match(client, /pptxgen\.min\.js\?v=014618/);
assert.match(page, /pptxgen\.min\.js\?v=014618/);
assert.match(page, /work-notes\.js\?v=014618/);
assert.equal(version.trim(), 'v0.14.618');
assert.match(admin, /ADMIN v0\.14\.618/);
assert.match(index, /WEB v0\.14\.618/);
console.log('v0.14.618 bundled PptxGenJS dependency checks passed');
