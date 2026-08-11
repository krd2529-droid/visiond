import assert from 'node:assert/strict';import fs from 'node:fs';
const home=fs.readFileSync('public/home-modern-ai.css','utf8'),purchase=fs.readFileSync('public/purchase-modern-ai.css','utf8'),roadmap=fs.readFileSync('work-history/visiond/roadmap/VISIOND-ROADMAP.md','utf8');
assert.match(home,/\.vd-bottom a\{[^}]*background:var\(--vd-surface\)!important;[^}]*color:var\(--vd-ai-midnight\)!important/);
assert.match(home,/\.vd-bottom a:hover\{[^}]*background:var\(--vd-primary-soft\)!important/);
assert.match(purchase,/a\.vds-btn--secondary\{[^}]*background:var\(--vd-surface\)!important;[^}]*color:var\(--vd-ai-midnight\)!important/);
assert.match(purchase,/a\.vds-btn--secondary:hover\{[^}]*background:var\(--vd-primary-soft\)!important/);
assert.match(roadmap,/Solid black or black-looking product buttons are forbidden/);
console.log('v0.14.92 Product action white Tiffany AI Midnight palette passed');
