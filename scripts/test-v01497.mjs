import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const home=fs.readFileSync('public/promo-banner.js','utf8'),cart=fs.readFileSync('public/cart.js','utf8'),roadmap=fs.readFileSync('work-history/visiond/roadmap/VISIOND-ROADMAP.md','utf8');
for(const source of [home,cart])assert.match(source,/visiond-bundle-promo\.gif\?/);assert.doesNotMatch(home,/visiond-bundle-promo-v2\.png/);
const info=execFileSync('identify',['-format','%n %T\n','public/assets/visiond-bundle-promo.gif'],{encoding:'utf8'}),verbose=execFileSync('identify',['-verbose','public/assets/visiond-bundle-promo.gif'],{encoding:'utf8'});assert.match(info,/4 100/);assert.match(info,/4 130/);assert.match(verbose,/Iterations: 0/);
assert.match(roadmap,/animated four-frame looping bundle GIF/);assert.match(fs.readFileSync('VERSION.txt','utf8').trim(),/^v0\.14\.(?:9[7-9]|[1-9]\d{2,})$/);
console.log('v0.14.97 homepage and cart animated looping bundle GIF passed');
