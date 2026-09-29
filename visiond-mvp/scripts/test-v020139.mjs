import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

import './test-v020124-vsport-news.mjs';
import './test-v020139-vsport-news-discovery.mjs';
import './test-v020139-vsport-news-browser.mjs';

const root=new URL('../',import.meta.url),text=relative=>readFile(new URL(relative,root),'utf8'),sha256=async relative=>createHash('sha256').update(await readFile(new URL(relative,root))).digest('hex').toUpperCase();
const [version,home,admin,html,css,client,foundation,api,featureMap,packageText,migration]=await Promise.all(['VERSION.txt','public/index.html','public/admin.html','public/vsport.html','public/vsport.css','public/vsport.js','functions/_vsport.js','functions/api/admin/vsport.js','FEATURE-MAP.md','package.json','migrations/0111_vsport.sql'].map(text));
const releasedVersion=version.trim(),assetVersion=releasedVersion==='v0.20.140'?'020140':'020139';assert.ok(['v0.20.139','v0.20.140'].includes(releasedVersion));assert.match(home,new RegExp(`WEB ${releasedVersion.replaceAll('.','\\.')}`));assert.match(admin,new RegExp(`ADMIN ${releasedVersion.replaceAll('.','\\.')}`));assert.match(html,new RegExp(`src="/vsport\\.js\\?v=${assetVersion}"`));assert.doesNotMatch(html,/vsport\.js\?v=020122/);assert.match(html,/เวลาเอเชีย\/กรุงเทพฯ/);assert.match(html,/ย้อนหลังไม่เกิน 48 ชั่วโมง/);
assert.match(foundation,/export function bangkokNewsWindow/);assert.match(foundation,/export function resolveNewsTeam/);assert.match(foundation,/export function isNewsRssEnvelope/);assert.match(api,/newsDiscoveryCheckpoint/);assert.match(api,/windowKind:'fallback'/);assert.match(api,/NEWS_FETCH_ATTEMPTS=2/);assert.match(api,/NEWS_MAX_BYTES=2\*1024\*1024/);assert.match(client,/export function parseNewsCheckpoint/);assert.match(client,/export function formatNewsJobStatus/);assert.match(client,/ย้อนหลังไม่เกิน 48 ชั่วโมง/);assert.match(featureMap,/half-open/);assert.match(featureMap,/closed job checkpoint/);
assert.equal(await sha256('public/vsport.css'),'262CE0A73E4044B3F2FEABBD4DE65C5C98D635EDFD44AAABFEF2B395111A0EFC','V Sport CSS stays byte-identical');assert.equal(await sha256('migrations/0111_vsport.sql'),'0AD1F2DA8B5833615BAE8967A7953CB75F83CE9ABEBAC12E5F1E4CEC2321A59D','schema/migration stays byte-identical');
const packageJson=JSON.parse(packageText);assert.equal(packageJson.scripts['test:v020139'],'node scripts/test-v020139.mjs && npm run test:v020138');
const liveGraph=await Promise.all(['public/live-center.html','public/live-center.js','public/live-package-open.html','public/live-package-open.js','public/live-package-ai-host.js','public/live-package-player.js'].map(text));assert.ok(liveGraph.every(source=>source.includes('?v=020138')),'unrelated Live Center cache graph remains v0.20.138');assert.equal(liveGraph.some(source=>source.includes('?v=020139')),false);
const ledger=JSON.parse(await text('patch-ledgers/v0.20.139.json'));assert.equal(ledger.version,'v0.20.139');assert.equal(ledger.feature,'VSPORT-001');for(const required of ['functions/_vsport.js','functions/api/admin/vsport.js','public/vsport.js','public/vsport.html','scripts/test-v020139-vsport-news-discovery.mjs','scripts/test-v020139-vsport-news-browser.mjs','scripts/test-v020139.mjs'])assert.ok(ledger.files.includes(required),required);
console.log('v0.20.139 V Sport Bangkok-day news discovery release checks passed');
