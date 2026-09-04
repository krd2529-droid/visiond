import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, js, css, version, admin, index] = await Promise.all([
  read('public/work-notes.html'),
  read('public/work-notes.js'),
  read('public/work-notes.css'),
  read('VERSION.txt'),
  read('public/admin.html'),
  read('public/index.html'),
]);

assert.match(html, /เขียวทิฟฟานี่ VisionD · พื้นขาว/);
assert.match(html, /id="pptThemeImage"[^>]+accept="image\/jpeg,image\/png,image\/webp"/);
assert.match(html, /รูปธีมต้นแบบ/);
assert.match(html, /work-notes\.(?:css|js)\?v=014610/g);
assert.match(js, /blue:\{accent:'0ABAB5',pale:'FFFFFF',title:'063D3B'\}/);
assert.match(js, /paletteFromThemeImage/);
assert.match(js, /themeImage=\$\('#pptThemeImage'\)\.files/);
assert.match(js, /downloadPpt\(item,button,\{theme:\$\('#pptTheme'\)\.value,themeImage,/);
assert.match(js, /background=\{color:colors\.pale\}/);
assert.match(css, /\.theme-image-status/);
assert.equal(version.trim(), 'v0.14.610');
assert.match(admin, /ADMIN v0\.14\.610/);
assert.match(index, /WEB v0\.14\.610/);

console.log('v0.14.610 work-notes PowerPoint theme checks passed');
