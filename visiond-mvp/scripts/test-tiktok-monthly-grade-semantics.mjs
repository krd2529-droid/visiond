import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [provider, endpoint, client, migration] = await Promise.all([
  readFile(new URL('../functions/_tiktok_analyzer.js', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/admin/tiktok-analyzer/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/tiktok-analyzer.js', import.meta.url), 'utf8'),
  readFile(new URL('../migrations/0080_tiktok_monthly_grade_semantics.sql', import.meta.url), 'utf8')
]);

assert.match(provider, /A=อย่างน้อย 30 ชิ้นต่อเดือน/);
assert.match(provider, /B=16-29 ชิ้นต่อเดือน/);
assert.match(provider, /C=1-15 ชิ้นต่อเดือน/);
assert.match(provider, /period!==30/);
assert.doesNotMatch(endpoint, /orders_last_7_days/);
assert.match(endpoint, /orders_last_30_days/);
assert.match(endpoint, /VALUES\(\?,\?,\?,\?,'D'/);
assert.match(endpoint, /product_type:'D',inventory_status:'kept'/);
assert.match(endpoint, /product_type='D'.*product_type='F'/s);
assert.match(client, /สินค้าหลัก · ≥30 ชิ้น\/เดือน/);
assert.match(client, /เพิ่มเป็น D/);
assert.match(client, /x\.product_type === "D"/);
assert.match(migration, /source_kind IN \('manual_selection', 'marketplace_selection', 'sold_product_selection'\)/);

console.log('TikTok monthly grade semantics tests passed');
