import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeDeck } from '../functions/api/admin/work-notes/presentation.js';
import { paginateDeckSlides } from '../public/work-notes-ppt-layout.js';

const wrong = normalizeDeck({ deck_title: 'คู่มือ', slides: [{ title: 'ขั้นตอน', bullets: [
  { text: 'เปิดหน้าแรก', attachment_numbers: [2] },
  { text: 'กดปุ่มถัดไป', attachment_numbers: [1] },
] }] }, 'คู่มือ', 'blue', 2, '1. เปิดหน้าแรก [รูป 1]\n2. กดปุ่มถัดไป [รูป 2]');
assert.deepEqual(wrong.slides[0].bullets[0].attachment_numbers, [1]);
assert.deepEqual(wrong.slides[0].bullets[1].attachment_numbers, [2]);

const pages = paginateDeckSlides([{ title: 'สี่รูป', bullets: [{ text: 'ข้อความต้นฉบับ', attachment_numbers: [1, 2, 3, 4] }] }]);
assert.equal(pages.length, 2);
assert.deepEqual(pages.flatMap(page => page.bullets[0].attachment_numbers), [1, 2, 3, 4]);
assert.ok(pages.every(page => page.bullets[0].text === 'ข้อความต้นฉบับ'));

const client = await readFile(new URL('../public/work-notes.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/work-notes.html', import.meta.url), 'utf8');
const version = await readFile(new URL('../VERSION.txt', import.meta.url), 'utf8');
assert.doesNotMatch(client, /numbers\.slice\(0,2\)/);
assert.match(client, /imageBox\(image,x,2\.25,w,4\.05\)/);
assert.match(client, /hyperlink:link/);
assert.match(client, /กดที่รูปหรือข้อความนี้เพื่อดูรูปใหญ่/);
assert.match(client, /failedNumbers\.length/);
assert.match(html, /work-notes\.js\?v=02026/);
assert.equal(version.trim(), 'v0.20.27');

console.log('v0.20.24 authoritative image mapping and large-link layout checks passed');
