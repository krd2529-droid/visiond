import assert from'node:assert/strict';import fs from'node:fs';const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('public/work-links.html'),client=read('public/work-links.js'),css=read('public/work-links.css'),api=read('functions/api/admin/work-links/index.js'),migration=read('migrations/0073_work_links_platform.sql');
assert.equal(read('VERSION.txt').trim(),'v0.14.587');
assert.match(html,/id="linkPlatform"/);assert.match(html,/Facebook/);assert.match(html,/TikTok/);assert.match(html,/YouTube/);
assert.match(client,/platformIcons/);assert.match(client,/platform-badge/);assert.match(client,/item\.platform/);assert.match(client,/platform:\$\('#linkPlatform'\)\.value/);
assert.match(css,/\.platform-badge/);assert.match(css,/\.platform-icon/);
assert.match(api,/ADD COLUMN platform/);assert.match(api,/INSERT INTO admin_work_links\(label,url,platform,note,created_by\)/);assert.match(api,/SET label=\?,url=\?,platform=\?/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS admin_work_links/);assert.match(migration,/platform TEXT NOT NULL DEFAULT/);
console.log('v0.14.587 work link platform and logo checks passed');
