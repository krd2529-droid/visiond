import fs from'node:fs';import assert from'node:assert/strict';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),blog=read('public/blog.html'),shell=read('public/header-shell.css');
assert.equal(read('VERSION.txt').trim(),'v0.14.577');assert.match(read('public/index.html'),/WEB v0\.14\.577/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.577/);
assert.match(blog,/header-shell\.css\?v=014577/);assert.match(blog,/header-shell\.js\?v=014577/);assert.match(shell,/border-radius:999px!important/);assert.match(shell,/background:transparent!important/);assert.match(shell,/nav>\[aria-current="page"\].*background:#fff!important/);
console.log('v0.14.577 rounded blog header checks passed');
