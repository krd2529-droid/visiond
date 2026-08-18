import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [version, index, admin, connect, settings] = await Promise.all([
  read('VERSION.txt'), read('public/index.html'), read('public/admin.html'),
  read('public/v12-connect.html'), read('public/v12-settings.html')
]);
assert.equal(version.trim(), 'v0.14.246');
assert.match(index, /<head>[\s\S]*<meta name="facebook-domain-verification" content="57crwi3pibbzq8bi53nhsrc2a0xv1d" \/>[\s\S]*<\/head>/);
assert.equal((index.match(/facebook-domain-verification/g) || []).length, 1);
assert.match(index, /WEB v0\.14\.246/);
assert.match(admin, /ADMIN v0\.14\.246/);
assert.match(connect, /v0\.14\.246/);
assert.match(settings, /v0\.14\.246/);
console.log('v0.14.246 Meta domain verification tag and visible version: PASS');
