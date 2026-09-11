import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
const src=readFileSync('public/tiktok-analyzer.js','utf8'),sold=src.slice(src.indexOf('function soldProductSummaryTable('),src.indexOf('function soldProductName('));
assert.doesNotMatch(sold,/ลิงก์สินค้า|productLinkControl/);
assert.match(src,/function productLinkControl\(/);assert.ok((src.match(/productLinkControl\(/g)||[]).length>1,'other product link controls retained');
assert.match(src,/productsById.get\(row.cells\[3\]/);assert.match(src,/row.cells\[4\]/);
await import('./test-v02091.mjs');
console.log('v100 sold base6/decorated7, blankURL action/grades/owner, other link controls retained: PASS');
