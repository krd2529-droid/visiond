import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8'),html=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.name.endsWith('.html'))html.push(full)}}walk(fileURLToPath(new URL('public/',root)));
assert.equal(read('VERSION.txt').trim(),'v0.14.428');assert.match(read('public/index.html'),/WEB v0\.14\.428/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.428/);
const icon=read('public/favicon.svg');assert.match(icon,/viewBox="0 0 64 64"/);assert.match(icon,/#087b75/);assert.match(icon,/#d6b96d/);
assert.equal(html.length,52);for(const file of html){const source=fs.readFileSync(file,'utf8');assert.match(source,/<link rel="icon" href="\/favicon\.svg\?v=014428" type="image\/svg\+xml"\s*\/?/)}
console.log(`PASS v0.14.428 VisionD favicon on ${html.length} HTML pages`);
