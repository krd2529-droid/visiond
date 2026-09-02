import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const [schema,feed,adminPage,storePage,version]=await Promise.all(['functions/_toys_center.js','functions/api/toys-center/feed.csv.js','public/toys-center-admin.html','public/toyscenter.html','VERSION.txt'].map(read));
assert.match(schema,/await env\.DB\.exec\(/);assert.doesNotMatch(schema,/await env\.DB\.batch\(/);assert.match(schema,/CREATE TABLE IF NOT EXISTS toys_center_settings/);assert.match(schema,/CREATE TABLE IF NOT EXISTS toys_center_products/);assert.match(schema,/INSERT OR IGNORE INTO toys_center_settings/);
assert.match(feed,/mediaUrl\(origin,r.id,2\)/);assert.match(adminPage,/toys-center-admin\.js\?v=014568/);assert.match(storePage,/toyscenter\.js\?v=014568/);assert.equal(version.trim(),'v0.14.568');
console.log('v0.14.568 Toys Center production schema bootstrap checks passed');
