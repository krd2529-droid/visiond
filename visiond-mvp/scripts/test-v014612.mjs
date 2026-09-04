import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, version, admin, index] = await Promise.all([
  read('public/toys-center-admin.html'),
  read('VERSION.txt'),
  read('public/admin.html'),
  read('public/index.html'),
]);

const formStart = html.indexOf('<form id="productForm"');
const image1 = html.indexOf('name="image_1"', formStart);
const image2 = html.indexOf('name="image_2"', formStart);
const ai = html.indexOf('id="aiFillProduct"', formStart);
const sku = html.indexOf('name="meta_id"', formStart);
assert.ok(formStart >= 0 && image1 > formStart && image2 > image1 && ai > image2 && sku > ai, 'images and AI action must be the first form workflow');
assert.equal((html.match(/name="image_1"/g) || []).length, 1);
assert.equal((html.match(/name="image_2"/g) || []).length, 1);
assert.equal((html.match(/id="aiFillProduct"/g) || []).length, 1);
assert.equal(version.trim(), 'v0.14.612');
assert.match(html, /v0\.14\.612/);
assert.match(admin, /ADMIN v0\.14\.612/);
assert.match(index, /WEB v0\.14\.612/);

console.log('v0.14.612 Toys Center image-first form checks passed');
