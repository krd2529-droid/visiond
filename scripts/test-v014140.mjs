import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const html = read('public/index.html');
const courses = read('public/home-course-catalog.js');
const catalog = read('public/catalog-sync.js');
const css = read('public/home-modern-ai.css');
const legacyCss = read('public/style.css');

assert.equal(read('VERSION.txt').trim(), 'v0.14.140');
assert.match(html, /id="courses" class="home-course-catalog/);
assert.match(html, /class="home-course-intro"/);
assert.match(html, /id="homeCourseSearch"/);
assert.match(html, /id="clearHomeCourseSearch"/);
assert.match(html, /id="homeCourseSearchCount"/);
assert.doesNotMatch(html, /id="digital-categories"|เลือกประเภทสินค้าดิจิทัล/);
assert.doesNotMatch(html, /ดูคอร์สทั้งหมด|เลือกดูคอร์สเรียน|ดูสินค้าดิจิทัลทั้งหมด|href="#digital-categories"/);
assert.doesNotMatch(catalog, /catalog-course-category|คอร์สออนไลน์/);
assert.match(courses, /platform_tags/);
assert.match(courses, /ดูคอร์สและสั่งซื้อ/);
assert.match(courses, /เข้าเรียน/);
assert.doesNotMatch(courses, /vd_cart|localStorage|ใส่รถเข็น/);
assert.match(css, /home-course-intro/);
assert.match(css, /@media\(max-width:760px\).*home-course-intro\{grid-template-columns:1fr\}/s);
assert.doesNotMatch(legacyCss, /digital-categories-section|digital-category-grid|digital-category-card/);
assert.match(html, /WEB v0\.14\.140/);
assert.match(read('public/admin.html'), /ADMIN v0\.14\.140/);

console.log('v0.14.140 home catalog cleanup checks passed');
