import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [process.env.PLAYWRIGHT_PACKAGE, 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright', 'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
if (!chromium) throw new Error('Playwright unavailable');

const root = path.resolve('public');
let program = null, createBody = '', publishBody = null, publishCalls = 0;
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/admin/vision7/programs' && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    createBody = Buffer.concat(chunks).toString('latin1');
    program = { id: 73, code: 'v-record', app_name: 'V-Record', platform_type: 'windows', current_version: '0.6.0', active: 0, plans: JSON.stringify([{ plan_code: 'monthly', product_id: 301 }, { plan_code: 'yearly', product_id: 302 }]) };
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, id: 73 })); return;
  }
  if (pathname === '/api/admin/vision7/vrecord-publish' && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    publishBody = JSON.parse(Buffer.concat(chunks).toString());
    publishCalls++;
    res.setHeader('content-type', 'application/json');
    if (publishCalls === 1) { res.statusCode = 409; res.end(JSON.stringify({ error: 'ไฟล์รีลีสในคลังไม่ครบ' })); }
    else { program.active = 1; res.end(JSON.stringify({ ok: true, program_id: 73 })); }
    return;
  }
  const api = {
    '/api/admin/vision7/programs': { items: program ? [program] : [], product_options: [], product_options_available: true },
    '/api/admin/vision7/licenses': { items: [], encryption_ready: true, operator: { id: 1 } },
    '/api/admin/vision7/releases': { items: [] },
    '/api/admin/users': { items: [] },
  }[pathname];
  if (api) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(api)); return; }
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root + path.sep)) { res.statusCode = 404; res.end(); return; }
  try {
    const content = readFileSync(file);
    res.setHeader('content-type', pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(content);
  } catch { res.statusCode = 404; res.end(); }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/vision7-admin.html`);
  await page.locator('#newVRecord').click();
  assert.equal(await page.locator('#vrecordDialog').evaluate((el) => el.open), true);
  await page.locator('#vrecordForm [name="description"]').fill('โปรแกรมบันทึกหน้าจอ Windows');
  await page.locator('#vrecordForm [name="cover"]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('cover') });
  await page.locator('#vrecordForm [name="installer"]').setInputFiles({ name: 'V-Record-0.6.0.zip', mimeType: 'application/zip', buffer: Buffer.from('zip') });
  await page.locator('#saveVRecord').click();
  await page.locator('[data-publish-vrecord="73"]').waitFor();
  for (const value of ['v-record', 'windows', '0.6.0', 'false', 'monthly', 'yearly', '199', '999', 'cover.png', 'V-Record-0.6.0.zip']) assert.ok(createBody.includes(value), `create request includes ${value}`);
  assert.ok(!createBody.includes('lifetime'), 'no lifetime plan is submitted');
  assert.equal(await page.locator('#newVRecord').isDisabled(), true, 'duplicate creation disabled');
  assert.match(await page.locator('#programs').innerText(), /ยังไม่เปิดขาย/);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('[data-publish-vrecord="73"]').click();
  assert.equal(publishCalls, 0, 'cancelled confirmation does not publish');
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('[data-publish-vrecord="73"]').click();
  await page.locator('[data-publish-state]').getByText('ไฟล์รีลีสในคลังไม่ครบ').waitFor();
  assert.deepEqual(publishBody, { program_id: 73, confirm: 'publish-v-record' });
  assert.equal(await page.locator('[data-publish-vrecord="73"]').isEnabled(), true, 'publish can retry after visible failure');
  await page.locator('[data-publish-vrecord="73"]').click();
  await page.getByText('เผยแพร่แล้ว', { exact: false }).first().waitFor();
  assert.equal(await page.locator('[data-publish-vrecord]').count(), 0, 'published program has no repeat action');
  assert.equal(publishCalls, 2);
  await page.locator('#newProgram').click();
  assert.equal(await page.locator('#programForm [name="price_lifetime"]').count(), 1, 'generic program builder remains available');
  console.log('PASS V-Record admin browser: exact inactive create, no lifetime, publish failure/retry, generic builder preserved');
} finally { await browser.close(); server.close(); }
