import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home=readFileSync('public/index.html','utf8');
const admin=readFileSync('public/admin.html','utf8');
const css=readFileSync('public/style.css','utf8');
assert.match(home,/class="visiond-build-version"[^>]*>WEB v0\.14\.136</);
assert.match(admin,/class="visiond-build-version"[^>]*>ADMIN v0\.14\.136</);
assert.match(css,/\.visiond-build-version\{/);
assert.equal(readFileSync('VERSION.txt','utf8').trim(),'v0.14.136');
console.log('v0.14.136 visible build version PASS');
