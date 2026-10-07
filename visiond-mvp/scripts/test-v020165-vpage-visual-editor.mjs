import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const required=[
  'migrations/0127_vpage_media.sql',
  'functions/_vpage-media.js',
  'functions/api/vpage/pages/[id]/media.js',
  'functions/api/vpage/pages/[id]/media/[mediaId].js',
  'functions/api/vpage/media/[id].js'
];
for(const path of required)assert.equal(existsSync(new URL(path,root)),true,`${path} is required`);

const migration=read('migrations/0127_vpage_media.sql');
assert.match(migration,/CREATE TABLE vpage_media/i);
assert.match(migration,/owner_id[\s\S]*page_id[\s\S]*object_key/i);
assert.match(migration,/UNIQUE\s*\(owner_id\s*,\s*idempotency_key\)/i);
assert.match(migration,/CREATE INDEX idx_vpage_media_owner_page/i);
assert.match(migration,/CREATE INDEX idx_vpage_media_page_state/i);

const helper=read('functions/_vpage-media.js'),upload=read('functions/api/vpage/pages/[id]/media.js'),remove=read('functions/api/vpage/pages/[id]/media/[mediaId].js'),serve=read('functions/api/vpage/media/[id].js');
assert.match(helper,/image\/png[\s\S]*image\/jpeg[\s\S]*image\/webp/);
assert.match(helper,/VPAGE_IMAGE_MAX_BYTES/);
assert.match(helper,/VPAGE_MEDIA_PER_PAGE_LIMIT/);
assert.match(helper,/inspectVpageImage/);
assert.match(upload,/requireUser/);
assert.match(upload,/Idempotency-Key|idempotency-key/);
assert.match(upload,/vpage-media\//);
assert.match(upload,/status='active'[\s\S]*datetime\(expires_at\)>CURRENT_TIMESTAMP/);
assert.match(remove,/vpage_media_refs/);
assert.match(remove,/VPAGE_MEDIA_IN_USE/);
assert.match(helper,/JOIN vpage_pages/);
assert.match(helper,/m\.id=\?[\s\S]*m\.state='ready'/);
assert.doesNotMatch(serve,/json_extract|LIKE\s+['"]%/i,'Vpage media serving must use indexed rows, never JSON/text scans');

const html=read('public/vpage.html'),css=read('public/vpage.css'),owner=read('public/vpage.js'),boss=read('public/vpage-admin.js');
assert.match(html,/data-vpage-template-version="1"/);
assert.match(css,/vpage-template-canvas/);
assert.match(css,/@media\(max-width:720px\)/);
assert.match(owner,/vpage-template-canvas/);
assert.match(owner,/type="file"[\s\S]*image\/jpeg,image\/png,image\/webp/);
assert.match(owner,/URL\.createObjectURL/);
assert.match(owner,/\/api\/vpage\/pages\/[^`]+\/media/);
assert.match(owner,/ชุดเนื้อหา 1[\s\S]*ชุดเนื้อหา 2/);
assert.match(owner,/data-template-slot="hero"[\s\S]*data-template-slot="detail"[\s\S]*data-template-slot="products"[\s\S]*data-template-slot="contacts"[\s\S]*data-template-slot="background"/);
assert.match(owner,/ArrowLeft[\s\S]*ArrowRight[\s\S]*Home[\s\S]*End/,'owner tabs support the complete roving keyboard contract');
assert.match(owner,/data-item-field="image_url"[\s\S]*dataset\.previewUrl[\s\S]*createElement\('img'\)/,'owner item image selections render a local blob preview');
assert.match(boss,/vpage-template-canvas/,'Boss retains a compatible visual content editor');
assert.match(boss,/ArrowLeft[\s\S]*ArrowRight[\s\S]*Home[\s\S]*End/,'Boss tabs support the complete roving keyboard contract');
assert.match(boss,/bossPreviewUrl[\s\S]*data-template-slot="hero"[\s\S]*createElement\('img'\)/,'Boss canvas renders safe hero, background and item URLs');
assert.doesNotMatch(boss,/type="file"|\/media(?:`|\?|\")/,'Boss must not silently upload as the customer');

console.log('PASS Vpage visual template editor and owner-scoped media static contract');
