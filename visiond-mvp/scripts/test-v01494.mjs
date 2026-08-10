import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const cart=fs.readFileSync('public/cart.js','utf8'),roadmap=fs.readFileSync('work-history/visiond/roadmap/VISIOND-ROADMAP.md','utf8');
assert.match(cart,/visiond-bundle-promo\.gif\?v=0149\d/);assert.doesNotMatch(cart,/visiond-bundle-promo-v2\.png\?v=0149/);
const info=execFileSync('identify',['-format','%n %T\\n','public/assets/visiond-bundle-promo.gif'],{encoding:'utf8'}),verbose=execFileSync('identify',['-verbose','public/assets/visiond-bundle-promo.gif'],{encoding:'utf8'});assert.match(info,/4 100/);assert.match(info,/4 130/);assert.match(verbose,/Iterations: 0/);
assert.match(roadmap,/animated four-frame GIF and must keep looping/);
console.log('v0.14.94 Animated four-frame looping bundle promo restored');
