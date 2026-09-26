import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import './test-v020130-live-ai-host-browser.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const text = async path => (await read(path)).toString('utf8');
const sha256 = async path => createHash('sha256').update(await read(path)).digest('hex').toUpperCase();

assert.ok(['v0.20.130', 'v0.20.131', 'v0.20.132', 'v0.20.133', 'v0.20.134', 'v0.20.135'].includes((await text('VERSION.txt')).trim()));
assert.match(await text('public/index.html'), /WEB v0\.20\.(?:130|131|132|133|134|135)/);
assert.match(await text('public/admin.html'), /ADMIN v0\.20\.(?:130|131|132|133|134|135)/);
assert.match(await text('public/live-center.html'), /live-center\.css\?v=020(?:130|131|132|133|134|135)/);
assert.match(await text('public/live-center.html'), /live-center\.js\?v=020(?:130|131|132|133|134|135)/);

const openerHtml = await text('public/live-package-open.html');
const openerSource = await text('public/live-package-open.js');
const hostSource = await text('public/live-package-ai-host.js');
const serverSource = await text('functions/_live_center.js');
assert.match(openerHtml, /live-center\.css\?v=020(?:130|131|132|133|134|135)/);
assert.match(openerHtml, /live-package-open\.js\?v=020(?:130|131|132|133|134|135)/);
for (const id of ['aiHostPanel', 'startAiHost', 'pauseAiHost', 'stopAiHost', 'skipAiProduct', 'retryAiHost', 'aiHostCue', 'aiLoopProducts', 'aiLiveCaption', 'obsAiHost', 'obsLiveCaption']) assert.match(openerHtml, new RegExp(`id="${id}"`));
assert.match(openerHtml, /AI พิธีกรสด/);
assert.match(openerHtml, /บทสดจาก VisionD AI · ไม่ใช่บทที่บันทึกในแพ็กเกจ/);
assert.match(openerSource, /createLiveAiHostController/);
assert.match(openerSource, /stopAiBeforeOfflineAction/);
assert.match(hostSource, /\/api\/admin\/live-center\/host-turn/);
assert.match(hostSource, /new AbortController\(\)/);
assert.match(hostSource, /prefetchedTurn/);
assert.match(hostSource, /recentTurns\.slice\(-LIVE_HOST_CONTEXT_LIMIT\)/);
assert.doesNotMatch(hostSource, /scene\.script|\.script\b|openai\.com|googleapis\.com|facebook|tiktok|shopee/i);
assert.match(serverSource, /live_center_host_turn/);
assert.match(serverSource, /LIVE_HOST_RATE_LIMIT=120/);
assert.match(serverSource, /LIVE_HOST_MAX_RECENT_TURNS=4/);
assert.match(serverSource, /SELECT id,title,description,brand,product_line,series,price_cents,currency,quantity FROM toys_center_products WHERE id=\?/);
assert.equal((await text('functions/api/admin/live-center/host-turn.js')).trim(), "import {generateLiveHostTurn} from '../../../_live_center.js';\n\nexport const onRequestPost=generateLiveHostTurn;");

const css = await text('public/live-center.css');
assert.match(css, /(?:\.obs-ai-host\[data-ai-host-state="thinking"\]|\.live-presenter-surface\[data-presenter-state="thinking"\])/);
assert.match(css, /(?:\.obs-ai-host\[data-ai-host-state="speaking"\]|\.live-presenter-surface\[data-presenter-state="talk"\])/);
assert.match(css, /@media\(max-width:520px\)[\s\S]*\.ai-host-actions/);
const featureMap = await text('FEATURE-MAP.md');
assert.match(featureMap, /AI พิธีกรสด/);
assert.match(featureMap, /active request สูงสุดหนึ่งกับ prefetched turn สูงสุดหนึ่ง/);
assert.match(featureMap, /ไม่แก้ show\/version\/package\/catalog\/order\/platform state/);
assert.equal(JSON.parse(await text('patch-ledgers/v0.20.130.json')).version, 'v0.20.130');
assert.equal(JSON.parse(await text('package.json')).scripts['test:v020130'], 'node scripts/test-v020130.mjs && npm run test:v020129');

assert.equal(await sha256('public/live-center-package.js'), '0BDC88818EA1369614B0275B9442E1E0C17C17AE502614E2145BEE1D7AB26E35', 'schema-v1 parser must remain byte-identical');
const playerSource = await text('public/live-package-player.js');
assert.ok(await sha256('public/live-package-player.js') === '1EF48EB00CAC02ABF925F49618DABCF782C1D816A5BE0DF12289A416E3665D9C'
  || (/createThaiSpeechNarrator/.test(playerSource) && !/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(playerSource)), 'offline local player may change only for the network-free shared Thai narrator');

console.log('v0.20.130 visible version, private AI-host surface, release ledger and offline byte-identity checks passed');
