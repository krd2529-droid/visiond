import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const css=fs.readFileSync('public/home-modern-ai.css','utf8');
assert.equal(fs.readFileSync('VERSION.txt','utf8').trim(),'v0.14.143');
assert.match(html,/class="home-hero-dual"/);
assert.ok(html.indexOf('home-hero-course') < html.indexOf('home-hero-digital'));
assert.match(html,/href="#courses">เลือกดูคอร์ส/);
assert.match(html,/href="\/digital-products\.html">ดูสินค้าดิจิทัล/);
assert.match(css,/grid-template-columns:3fr 2fr/);
assert.match(css,/\.home-hero-course\{[^}]*border:2px solid var\(--vd-primary\)/);
assert.match(css,/@media\(max-width:760px\)[\s\S]*\.home-hero-dual\{grid-template-columns:1fr\}/);
assert.doesNotMatch(html+css,/home-course-intro/);
assert.doesNotMatch(html,/home-contact-section|สอบถามก่อนสั่งซื้อได้ทุกหมวด/);
assert.match(html,/WEB v0\.14\.143/);
assert.match(fs.readFileSync('public/admin.html','utf8'),/ADMIN v0\.14\.143/);
console.log('v0.14.143 dual hero checks passed');
