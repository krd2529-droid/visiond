import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('public/admin.html');
const ui = read('public/paper-doll-set-builder.js');
const api = read('functions/api/admin/products/index.js');

assert.match(read('VERSION.txt'), /v0\.14\.313/);
assert.match(html, /paper-doll-set-builder\.js\?v=014313/);
assert.match(html, /paper-doll-set-builder\.css\?v=014313/);
assert.match(html, /id="paperDollSetBuilderButton"[\s\S]*สร้างตะกร้าตุ๊กตากระดาษ/);
assert.match(ui, /const allocation = \(pageCount, basketCount\)/);
assert.match(ui, /source", "paper_doll_set"/);
assert.match(ui, /status", "draft"/);
assert.match(api, /async function nextProductSlug\(env,category\)/);
assert.match(api, /const prefix=`\$\{category\}-`/);
assert.match(api, /slug=await nextProductSlug\(ctx\.env,category\)/);
assert.match(api, /slug\.slice\(`\$\{category\}-`\.length\)/);
assert.doesNotMatch(api, /paper-doll-set-/);
assert.match(api, /paperDollSet\?'draft'/);

const allocation = (pageCount, basketCount) => {
  const base = Math.floor(pageCount / basketCount), remainder = pageCount % basketCount;
  let cursor = 0;
  return Array.from({ length: basketCount }, (_, index) => {
    const count = base + (index < remainder ? 1 : 0), start = cursor;
    cursor += count;
    return { start, end: cursor - 1, count };
  });
};
assert.deepEqual(allocation(30, 5).map(x => x.count), [6, 6, 6, 6, 6]);
assert.deepEqual(allocation(100, 5).map(x => x.count), [20, 20, 20, 20, 20]);
assert.deepEqual(allocation(20, 5).map(x => x.count), [4, 4, 4, 4, 4]);
assert.deepEqual(allocation(7, 5).map(x => x.count), [2, 2, 1, 1, 1]);

console.log('PASS v0.14.313 PD-SET-001 uses normal paper-doll slug sequence');
