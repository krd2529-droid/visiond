import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

import './test-v020125-live-center-ai.mjs';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root));
const text=async path=>(await read(path)).toString('utf8');
const sha256=async path=>createHash('sha256').update(await read(path)).digest('hex').toUpperCase();

assert.equal((await text('VERSION.txt')).trim(),'v0.20.127');
assert.match(await text('public/index.html'),/WEB v0\.20\.127/);
assert.match(await text('public/admin.html'),/ADMIN v0\.20\.127/);
assert.match(await text('public/live-center.html'),/live-center\.js\?v=020127/);
assert.match(await text('FEATURE-MAP.md'),/structural order/);

const unchangedVsport={
  'migrations/0111_vsport.sql':'0AD1F2DA8B5833615BAE8967A7953CB75F83CE9ABEBAC12E5F1E4CEC2321A59D',
  'functions/_vsport.js':'976BFECEC019BE414734B4DC8DD8B75E3C9C6B06690B4F105426CD333B5FA2B5',
  'functions/api/admin/vsport.js':'C695DDC0A71B9C7300D1E52C910BF07F85583439B733B6B006E26D3154A9322E',
  'functions/api/admin/vsport-assets/[id].js':'6BEF06AD1B137C56707D6F01CE0F86777CB79D8D6EFF108C763F9C07EAB4A434',
  'public/vsport.html':'7F4315D8ECD75762D15B31224F763561FA98DF71A5020A21965ABBC4F7A21ABC',
  'public/vsport.css':'262CE0A73E4044B3F2FEABBD4DE65C5C98D635EDFD44AAABFEF2B395111A0EFC',
  'public/vsport.js':'1A257C80E9C734081FF3E56DE56A260F25DEB01FE6DD785C1A938C4986F2159F',
  'scripts/test-v020124-vsport-news.mjs':'4924FD3925702A27219C7982EB59B47D80E2B19221D4FAF3D1BD074AA3D70CF1',
};
for(const [path,expected] of Object.entries(unchangedVsport))assert.equal(await sha256(path),expected,`${path} must remain byte-identical to released vSport`);

console.log('v0.20.127 Live Center product-plan ordering fix and vSport byte-identity checks passed');
