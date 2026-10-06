import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const required=[
  '../services/vpage/migrations/0002_vpage_editor.sql',
  '../migrations/0125_vpage_editor.sql',
  '../functions/api/vpage/pages/[id]/editor.js',
  '../functions/api/vpage/pages/[id]/content-sets/[set].js',
  '../functions/api/vpage/pages/[id]/active-set.js',
  '../functions/api/admin/vpage/pages/index.js',
  '../functions/api/admin/vpage/pages/[id]/editor.js',
  '../functions/api/admin/vpage/pages/[id]/active-set.js'
];
for(const relative of required)assert.ok(existsSync(new URL(relative,import.meta.url)),`missing Vpage editor contract file: ${relative}`);

const service=readFileSync(new URL('../services/vpage/src/index.js',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../functions/_vpage-provisioning.js',import.meta.url),'utf8');
const serviceMigration=readFileSync(new URL(required[0],import.meta.url),'utf8');
const visionMigration=readFileSync(new URL(required[1],import.meta.url),'utf8');
const ownerRoutes=required.slice(2,5).map(relative=>readFileSync(new URL(relative,import.meta.url),'utf8')).join('\n');
const bossRoutes=required.slice(5).map(relative=>readFileSync(new URL(relative,import.meta.url),'utf8')).join('\n');
const ui=readFileSync(new URL('../public/vpage.html',import.meta.url),'utf8')+readFileSync(new URL('../public/vpage.js',import.meta.url),'utf8');
const bossUi=readFileSync(new URL('../public/vpage-admin.html',import.meta.url),'utf8')+readFileSync(new URL('../public/vpage-admin.js',import.meta.url),'utf8');

assert.match(serviceMigration,/active_set[\s\S]*CHECK\s*\(active_set IN \(1,2\)\)/i);
assert.match(serviceMigration,/public_generation[\s\S]*CHECK\s*\(public_generation>=0\)/i);
assert.match(serviceMigration,/CREATE TABLE vpage_content_sets/i);
assert.match(serviceMigration,/CREATE TABLE vpage_set_audit/i);
assert.match(serviceMigration,/CREATE TABLE vpage_editor_requests/i);
assert.match(visionMigration,/idx_vpage_pages_domain_cursor/i);
assert.match(service,/content-sets/);
assert.match(service,/active-set/);
assert.match(service,/previous_set/);
assert.match(service,/VPAGE_CONTENT_SET_INCOMPLETE/);
assert.match(service,/x-vpage-generation/);
assert.match(service,/public_generation=public_generation\+1/);
assert.match(bridge,/editorGenerations/);
assert.match(service,/custom_domain|active_set/);
assert.match(ownerRoutes,/requireUser/);
assert.match(ownerRoutes,/user_id=\?/);
assert.match(bossRoutes,/requireBoss/);
assert.doesNotMatch(bossRoutes,/requireAdmin/);
assert.match(ui,/ชุดเนื้อหา 1/);
assert.match(ui,/ชุดเนื้อหา 2/);
assert.match(ui,/ชื่อร้านร่วมกัน/);
assert.match(bossUi,/สลับชุดเนื้อหา/);
console.log('PASS Vpage editor/two-set static contract');
