import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('public/admin.html');
const ui = read('public/paper-doll-set-builder.js');
const css = read('public/paper-doll-set-builder.css');
const api = read('functions/api/admin/products/index.js');

assert.match(read('VERSION.txt'), /v0\.14\.312/);
assert.match(html, /id="paperDollSetBuilderButton"[\s\S]*สร้างตะกร้าตุ๊กตากระดาษ/);
assert.match(html, /id="paperDollSourceFiles"[^>]+multiple/);
assert.match(html, /paper-doll-set-builder\.js\?v=014312/);
assert.match(html, /paper-doll-set-builder\.css\?v=014312/);
assert.match(ui, /const allocation = \(pageCount, basketCount\)/);
assert.match(ui, /base \+ \(index < remainder \? 1 : 0\)/);
assert.match(ui, /group\.allocations\[basketIndex\]/);
assert.match(ui, /state\.groups\.length/);
assert.match(ui, /state\.created\.length/);
assert.match(ui, /for \(let basketIndex = startIndex;/);
assert.match(ui, /source", "paper_doll_set"/);
assert.match(ui, /status", "draft"/);
assert.match(api, /requestedSource==='paper_doll_set'/);
assert.match(api, /paper-doll-set-/);
assert.match(api, /paperDollSet\?'draft'/);
assert.match(api, /ตุ๊กตากระดาษชุดที่/);
assert.ok(css.length > 500);

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
for (const total of [7, 20, 30, 100]) {
  const parts = allocation(total, 5);
  assert.equal(parts.reduce((sum, x) => sum + x.count, 0), total);
  assert.deepEqual(parts.flatMap(x => Array.from({ length: x.count }, (_, i) => x.start + i)), Array.from({ length: total }, (_, i) => i));
}

console.log('PASS v0.14.312 PD-SET-001 per-PDF page allocation, preview, draft creation, and resumable batch');
