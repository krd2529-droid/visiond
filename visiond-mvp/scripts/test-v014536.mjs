import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [provider, client, page, version] = await Promise.all([
  read('functions/_tiktok_analyzer.js'),
  read('public/tiktok-analyzer.js'),
  read('public/tiktok-analyzer.html'),
  read('VERSION.txt'),
]);

assert.match(provider, /C=สินค้าอยู่ในช่วงทดสอบ 72 ชั่วโมงแรก/);
assert.match(provider, /มีหลักฐานว่าขายได้ให้เลื่อนเป็น B/);
assert.match(provider, /ให้เปลี่ยนเป็น F ทันทีโดยไม่ต้องรอ 7 วัน/);
assert.match(provider, /ครบ 72 ชั่วโมงแล้ววิวหรือทราฟฟิกต่ำและไม่มีการขาย/);
assert.match(client, /C:'ทดสอบ 3 วัน · ขายได้ไป B · ไม่เวิร์กไป F'/);
assert.match(page, /C ทดสอบ 3 วัน ขายได้ไป B ไม่เวิร์กไป F/);
assert.equal(version.trim(), 'v0.14.536');

console.log('v0.14.536 grade C checks passed');
