import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const required=[
  '../services/vpage/src/index.js',
  '../services/vpage/src/homepage.js',
  '../services/vpage/migrations/0001_vpage_service.sql',
  '../services/vpage/wrangler.toml.example',
  '../migrations/0124_vpage_provisioning.sql',
  '../migrations/0129_vpage_create_content.sql',
  '../functions/api/vpage/domains.js',
  '../functions/api/vpage/availability.js',
  '../functions/api/vpage/pages/index.js',
  '../functions/api/vpage/pages/[id]/repair.js'
];
for(const relative of required)assert.ok(existsSync(new URL(relative,import.meta.url)),`missing Vpage provisioning contract file: ${relative}`);

const sources=required.map(relative=>readFileSync(new URL(relative,import.meta.url),'utf8')).join('\n');
assert.match(sources,/smartlinkpage\.com/);
assert.match(sources,/บริการเซลเพจเพื่อธุรกิจออนไลน์/);
assert.match(sources,/VPAGE_SHARED_SECRET/);
assert.match(sources,/idempotency/i);
assert.match(sources,/nonce/i);
assert.match(sources,/repair_required/);
assert.match(sources,/create_content_json/);
assert.match(sources,/create_active_set/);
assert.match(sources,/normalizeVpageCreateContent/);
assert.match(sources,/content_digest/);
assert.match(sources,/local\.create_idempotency_key/);
assert.match(sources,/WHERE id=\? AND user_id=\?/);
assert.match(sources,/VPAGE_REPAIR_BODY_FORBIDDEN/);
assert.match(sources,/CHECK\s*\(slot BETWEEN 1 AND 10\)/i);
assert.doesNotMatch(sources,/customer[_-]?secret|customer[_-]?key/i);

const ui=readFileSync(new URL('../public/vpage.html',import.meta.url),'utf8')+readFileSync(new URL('../public/vpage.js',import.meta.url),'utf8');
assert.match(ui,/สร้างเซลเพจ/);
assert.match(ui,/https:\/\/smartlinkpage\.com\//);
assert.match(ui,/maxlength="50"/);
assert.match(ui,/ตรวจสอบและดำเนินการต่อ/);
assert.match(ui,/data-create-content-set/);
assert.doesNotMatch(ui,/vpageCreateActiveSet/);
assert.ok(ui.includes(`active_set:Number(createSets.querySelector('[data-create-tab][aria-selected="true"]')?.dataset.createTab)`));
assert.match(ui,/หลังสร้างแล้ว/);
assert.match(ui,/\/repair`,\{method:'POST'\}/);
console.log('PASS Vpage provisioning service and VisionD contract');
