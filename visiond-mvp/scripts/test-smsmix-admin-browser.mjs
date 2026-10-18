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

const root = path.resolve('public'), hash = 'a'.repeat(64);
let program = null, createBody = '', publishBody = null, publishCalls = 0, issueBody = null, issueCalls = 0;
const otherProgram = { id: 75, code: 'other-app', product_title: 'Other App', platform_type: 'windows', current_version: '1.0', active: 1, plans: '[]' };
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/admin/vision7/programs' && req.method === 'POST') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    createBody = Buffer.concat(chunks).toString('latin1');
    program = { id: 74, code: 'sms-mix', app_name: 'VSMS', platform_type: 'android', current_version: '0.5.4', active: 0, plans: JSON.stringify([{ id: 501, name: 'คีย์ 30 วัน', duration_days: 30, code: 'monthly', product_id: 401 }, { id: 502, name: 'คีย์ 365 วัน', duration_days: 365, code: 'yearly', product_id: 402 }]) };
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, id: 74 })); return;
  }
  if (pathname === '/api/admin/vision7/licenses' && req.method === 'POST') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    issueBody = JSON.parse(Buffer.concat(chunks).toString()); issueCalls++;
    res.setHeader('content-type', 'application/json'); res.statusCode = 201;
    res.end(JSON.stringify({ ok: true, license: { key: 'VD7-TEST-ONLY' } })); return;
  }
  if (pathname === '/api/admin/vision7/smsmix-publish' && req.method === 'POST') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    publishBody = JSON.parse(Buffer.concat(chunks).toString()); publishCalls++;
    res.setHeader('content-type', 'application/json');
    if (publishCalls === 1) { res.statusCode = 409; res.end(JSON.stringify({ error: 'APK ในคลังไม่ครบ' })); }
    else { program.active = 1; res.end(JSON.stringify({ ok: true, program_id: 74 })); }
    return;
  }
  const api = {
    '/api/admin/vision7/programs': { items: program ? [program, otherProgram] : [], product_options: [], product_options_available: true },
    '/api/admin/vision7/licenses': { items: [], encryption_ready: true, operator: { id: 1 } },
    '/api/admin/vision7/releases': { items: [] },
    '/api/admin/users': { items: [{ id: 91, name: 'Recipient', username: 'recipient', email: 'recipient@example.test' }] },
  }[pathname];
  if (api) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(api)); return; }
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root + path.sep)) { res.statusCode = 404; res.end(); return; }
  try { const content = readFileSync(file); res.setHeader('content-type', pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.css') ? 'text/css' : 'text/html'); res.end(content); }
  catch { res.statusCode = 404; res.end(); }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/vision7-admin.html`);
  await page.locator('#newVsms').click();
  assert.equal(await page.locator('#vsmsDialog').evaluate(el => el.open), true);
  assert.match(await page.locator('#vsmsDialogTitle').innerText(), /เพิ่ม VSMS 0\.5\.4/);
  assert.match(await page.locator('#vsmsForm [name="installer"]').locator('..').innerText(), /APK Android 0\.5\.4 ที่เซ็นสำหรับจำหน่าย/);
  await page.locator('#vsmsForm [name="description"]').fill('VSMS สำหรับลูกค้าที่มีคีย์ VisionD');
  await page.locator('#vsmsForm [name="cover"]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('cover') });
  await page.locator('#vsmsForm [name="installer"]').setInputFiles({ name: 'VSMS-0.5.4.apk', mimeType: 'application/vnd.android.package-archive', buffer: Buffer.from('apk') });
  await page.locator('#saveVsms').click();
  await page.locator('[data-publish-vsms="74"]').waitFor();
  const vsmsRow = page.locator('#programs .program-row').first(), otherRow = page.locator('#programs .program-row').nth(1);
  assert.equal(await vsmsRow.locator('b').first().innerText(), 'VSMS');
  assert.equal(await vsmsRow.locator('code').first().innerText(), 'VSMS');
  assert.equal(await otherRow.locator('b').first().innerText(), 'Other App');
  assert.equal(await otherRow.locator('code').first().innerText(), 'other-app');
  assert.equal(await vsmsRow.getByRole('button', { name: 'ออกคีย์' }).isEnabled(), true);
  for (const value of ['sms-mix', 'android', '0.5.4', 'false', 'monthly', 'yearly', '999', '9999', 'duration_days', '30', '365', 'cover.png', 'VSMS-0.5.4.apk']) assert.ok(createBody.includes(value), `create request includes ${value}`);
  assert.ok(!createBody.includes('lifetime'), 'no lifetime or trial offer submitted');
  assert.equal(await page.locator('#newVsms').isDisabled(), true);
  assert.match(await page.locator('#programs').innerText(), /ยังไม่เปิดขาย/);
  let nativeDialogs = 0;
  page.on('dialog', async dialog => { nativeDialogs++; await dialog.dismiss(); });
  await page.locator('[data-publish-vsms="74"]').click();
  assert.equal(await page.locator('#vsmsPublishDialog').evaluate(el => el.open), true);
  assert.match(await page.locator('#vsmsPublishDialog').innerText(), /VSMS 0\.5\.4/);
  await page.locator('#vsmsPublishDialog [data-close]').click();
  assert.equal(publishCalls, 0, 'cancelled SHA confirmation does not publish');
  await page.locator('[data-publish-vsms="74"]').click();
  await page.locator('#vsmsPublishHash').fill('bad-hash');
  await page.locator('#vsmsPublishSubmit').click();
  assert.equal(publishCalls, 0, 'invalid hash does not publish');
  await page.locator('#vsmsPublishHash').fill(hash.toUpperCase());
  await page.locator('#vsmsPublishSubmit').click();
  await page.locator('#vsmsPublishState').getByText('APK ในคลังไม่ครบ').waitFor();
  assert.deepEqual(publishBody, { program_id: 74, confirm: 'publish-vsms', apk_sha256: hash });
  assert.equal(await page.locator('#vsmsPublishSubmit').isEnabled(), true);
  await page.locator('#vsmsPublishSubmit').click();
  await page.getByText('เผยแพร่แล้ว', { exact: false }).first().waitFor();
  assert.equal(await page.locator('#vsmsPublishDialog').evaluate(el => el.open), false);
  assert.equal(await page.locator('[data-publish-vsms]').count(), 0);
  assert.equal(publishCalls, 2);
  assert.equal(nativeDialogs, 0, 'VSMS publish never uses unsupported native prompts');
  await vsmsRow.getByRole('button', { name: 'อัปเดต VSMS 0.5.5' }).click();
  assert.equal(await page.locator('#releaseDetails').evaluate(el => el.open), true);
  assert.equal(await page.locator('#releaseProgram').inputValue(), '74');
  assert.equal(await page.locator('#releaseForm [name="version"]').inputValue(), '0.5.5');
  assert.equal(await page.locator('#releaseForm [name="minimum_version"]').inputValue(), '0.5.4');
  assert.equal(await page.locator('#releaseForm [name="mandatory"]').isDisabled(), true);
  assert.match(await page.locator('#vsmsReleaseHint').innerText(), /อัปเดตเสริมจาก 0\.5\.4/);
  await page.locator('#releaseProgram').selectOption('75');
  assert.equal(await page.locator('#releaseForm [name="mandatory"]').isEnabled(), true, 'generic release form remains available');
  await vsmsRow.getByRole('button', { name: 'ออกคีย์' }).click();
  assert.equal(await page.locator('#keyMode').inputValue(), 'vsms_manual');
  assert.equal(await page.locator('#keyProgram option:checked').innerText(), 'VSMS');
  assert.deepEqual(await page.locator('#keyPlan option').evaluateAll(options => options.map(x => x.value)), ['', '501', '502']);
  assert.deepEqual(await page.locator('#keyPlan option').evaluateAll(options => options.map(x => x.textContent)), ['เลือกแพ็กเกจ VSMS', '30 วัน', '1 ปี']);
  assert.equal(await page.locator('#keyUser').inputValue(), '', 'recipient must be selected');
  await page.locator('#keyUser').selectOption('91');
  await page.locator('#keyPlan').selectOption('501');
  await page.locator('#issueKeySubmit').click();
  assert.equal(issueCalls, 0, 'first submit only shows in-page confirmation');
  assert.match(await page.locator('#keyCostSummary').innerText(), /Recipient.*30 วัน.*ไม่มีการชำระเงิน/);
  await page.locator('#issueKeySubmit').click();
  await page.locator('#issuedKey').getByText('VD7-TEST-ONLY').waitFor();
  assert.equal(issueCalls, 1);
  assert.equal(issueBody.key_mode, 'vsms_manual');
  assert.equal(issueBody.user_id, '91');
  assert.equal(issueBody.plan_id, '501');
  assert.equal(issueBody.program_id, '74');
  assert.equal('test_duration' in issueBody, false);
  assert.equal(nativeDialogs, 0, 'VSMS manual issue uses in-page confirmation');
  await page.locator('#keyDialog [data-close]').click();
  await page.locator('#newProgram').click();
  assert.equal(await page.locator('#programForm [name="price_lifetime"]').count(), 1, 'generic builder preserved');
  console.log('PASS SMS Mix admin browser: staged exact plans, guarded hash publish and retry, generic builder preserved');
} finally { await browser.close(); server.close(); }
