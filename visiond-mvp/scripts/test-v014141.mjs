import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const html = read('public/index.html');
const js = read('public/home-course-catalog.js');
const css = read('public/home-modern-ai.css');

assert.equal(read('VERSION.txt').trim(), 'v0.14.141');
assert.match(js, /vd-card home-course-card vds-card vds-card--product/);
assert.match(js, /vd-cover home-course-cover/);
assert.match(js, /vd-info home-course-info/);
assert.match(js, /vd-bottom home-course-actions/);
assert.match(js, /vds-btn vds-btn--small vds-btn--secondary/);
assert.doesNotMatch(js, /vd-cover-slider|vd-slide-prev|vd-slide-next|vd-slide-count|data-slide/);
assert.match(css, /home-course-grid\{[^}]*minmax\(0,250px\)/);
assert.match(css, /home-course-cover\{[^}]*aspect-ratio:16\/9/);
assert.match(css, /home-course-cover img\{[^}]*object-fit:cover!important/);
assert.match(html, /home-modern-ai\.css\?v=014141/);
assert.match(html, /home-course-catalog\.js\?v=014141/);
assert.match(html, /WEB v0\.14\.141/);
assert.match(read('public/admin.html'), /ADMIN v0\.14\.141/);

console.log('v0.14.141 course card digital-style checks passed');
