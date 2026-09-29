import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

import './test-v020143-vsport-historical-images.mjs';
import './test-v020143-vsport-historical-images-browser.mjs';

const root=new URL('../',import.meta.url),read=relative=>readFile(new URL(relative,root)),text=async relative=>(await read(relative)).toString('utf8'),sha256=async relative=>createHash('sha256').update(await read(relative)).digest('hex').toUpperCase();
const [version,home,admin,html,css,client,foundation,api,featureMap,packageText,migration111,migration115]=await Promise.all(['VERSION.txt','public/index.html','public/admin.html','public/vsport.html','public/vsport.css','public/vsport.js','functions/_vsport.js','functions/api/admin/vsport.js','FEATURE-MAP.md','package.json','migrations/0111_vsport.sql','migrations/0115_vsport_project_delete.sql'].map(text));
assert.equal(version.trim(),'v0.20.143');
assert.match(home,/WEB v0\.20\.143/);assert.match(admin,/ADMIN v0\.20\.143/);assert.match(html,/src="\/vsport\.js\?v=020143"/);assert.doesNotMatch(html,/vsport\.js\?v=020142/);
assert.match(foundation,/export function isDisplayEligibleImageCandidate/);assert.match(foundation,/IMAGE_SUPPORTED_FORMAT_NEGOTIATION_FAILED/);assert.match(foundation,/new Set\(\['w','width'\]\)/);assert.match(foundation,/new Set\(\['h','height'\]\)/);assert.match(foundation,/covers-header-v2-dropdown-caret/);
assert.match(api,/display_eligible:isDisplayEligibleImageCandidate\(item\)/);assert.match(api,/'accept':'image\/webp,image\/png,image\/jpeg'/);assert.doesNotMatch(api,/image\/avif/);
assert.match(client,/หน้านี้มีเฉพาะรูปประกอบเว็บไซต์หรือรายการที่ไม่ผ่านเกณฑ์ จึงซ่อนไว้/);assert.match(featureMap,/v0\.20\.143/);assert.match(featureMap,/one legacy MIME recovery|one legacy/i);
assert.equal(await sha256('functions/_vsport.js'),'C23F799D69413F1D16A493D8A386CF741FEE758D3B9B66685626857143A67022');
assert.equal(await sha256('functions/api/admin/vsport.js'),'0D1776B49DBC31B684BFDCA4E62B86F2BE31B8D25EE973AFAC2964F057BFCB73');
assert.equal(await sha256('public/vsport.html'),'CF1B0F748C88E85E0AB4C0B290A75C57FD2B304D0ACA010F9838504D22416B51');
assert.equal(await sha256('public/vsport.js'),'9543B1DC78AC1E1EB7F152DA92F9D0E468212F64A75C6E717DDF02AB4C83C4E8');
assert.equal(await sha256('public/vsport.css'),'262CE0A73E4044B3F2FEABBD4DE65C5C98D635EDFD44AAABFEF2B395111A0EFC');
assert.equal(await sha256('functions/api/admin/vsport-assets/[id].js'),'6BEF06AD1B137C56707D6F01CE0F86777CB79D8D6EFF108C763F9C07EAB4A434');
assert.equal(await sha256('migrations/0111_vsport.sql'),'0AD1F2DA8B5833615BAE8967A7953CB75F83CE9ABEBAC12E5F1E4CEC2321A59D');
assert.equal(await sha256('migrations/0115_vsport_project_delete.sql'),'AFAB8039627D49A1BD3165740008169AF7AAB4B08E831C09E82A780C764DCBE4');
assert.match(migration111,/idx_vsport_candidates_project_id/);assert.match(migration115,/idx_vsport_cleanup_state_due/);
const packageJson=JSON.parse(packageText);assert.equal(packageJson.scripts['test:v020143'],'node scripts/test-v020143.mjs && npm run test:v020142');
const liveGraph=await Promise.all(['public/live-center.html','public/live-center.js','public/live-package-open.html','public/live-package-open.js','public/live-package-ai-host.js','public/live-package-player.js'].map(text));assert.ok(liveGraph.every(source=>source.includes('?v=020138')),'unrelated Live Center cache graph remains v0.20.138');assert.equal(liveGraph.some(source=>source.includes('?v=020143')),false);
const ledger=JSON.parse(await text('patch-ledgers/v0.20.143.json'));assert.equal(ledger.version,'v0.20.143');assert.equal(ledger.feature,'VSPORT-001');assert.equal(ledger.files.length,35);for(const required of ['functions/_vsport.js','functions/api/admin/vsport.js','public/vsport.js','public/vsport.html','scripts/test-v020143-vsport-historical-images.mjs','scripts/test-v020143-vsport-historical-images-browser.mjs','scripts/test-v020143.mjs'])assert.ok(ledger.files.includes(required),required);for(const forbidden of ['functions/api/admin/vsport-assets/[id].js','public/vsport.css','migrations/0111_vsport.sql','migrations/0115_vsport_project_delete.sql'])assert.equal(ledger.files.includes(forbidden),false,`${forbidden} stays outside task scope`);
console.log('v0.20.143 V Sport historical image candidate release checks passed');
