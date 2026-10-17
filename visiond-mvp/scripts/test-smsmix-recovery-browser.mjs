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
let missing = true, reconcileCalls = 0, requestBody = null;
const server = http.createServer(async (req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if (pathname === '/api/admin/vision7/smsmix-reconcile' && req.method === 'POST') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requestBody = JSON.parse(Buffer.concat(chunks).toString()); reconcileCalls++;
    res.setHeader('content-type','application/json');
    if (reconcileCalls === 1) { res.statusCode = 503; res.end(JSON.stringify({ error:'ออกคีย์ไม่สำเร็จ ลองใหม่' })); }
    else { missing = false; res.end(JSON.stringify({ ok:true, items:[{ license_id:'vsms-key', action:'issued' }] })); }
    return;
  }
  if (pathname.startsWith('/api/')) {
    const body = pathname === '/api/auth/me' ? { user:{ id:1, role:'boss', name:'Boss' } }
      : pathname === '/api/admin/orders' ? { items:[] }
      : pathname === '/api/admin/vision7/smsmix-missing' ? { items:missing ? [{ missing_item_id:801, order_id:88, order_no:'VSMS-88', total:99900, customer_name:'Buyer', customer_email:'buyer@example.com' }] : [], next_cursor:null }
      : { items:[], pagination:{ limit:24, has_more:false, next_cursor:null } };
    res.setHeader('content-type','application/json'); res.end(JSON.stringify(body)); return;
  }
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root + path.sep)) { res.statusCode=404; res.end(); return; }
  try { const content=readFileSync(file); res.setHeader('content-type', pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.css') ? 'text/css' : 'text/html'); res.end(content); }
  catch { res.statusCode=404; res.end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({ headless:true, channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/admin.html`);
  await page.locator('[data-vsms-reconcile="88"]').waitFor();
  assert.match(await page.locator('#vsmsMissingOrders').innerText(), /ชำระแล้ว แต่ยังไม่ได้ออกคีย์/);
  assert.equal(await page.locator('#adminOrders [data-vsms-reconcile]').count(), 0, 'unrelated order rows untouched');
  page.on('dialog', dialog => dialog.accept());
  await page.locator('[data-vsms-reconcile="88"]').click();
  await page.locator('[data-vsms-reconcile-state="88"]').getByText('ลองใหม่').waitFor();
  assert.deepEqual(requestBody, { order_id:88 });
  assert.equal(await page.locator('[data-vsms-reconcile="88"]').isEnabled(), true, 'failed recovery remains retryable');
  await page.locator('[data-vsms-reconcile="88"]').click();
  await page.locator('[data-vsms-reconcile="88"]').waitFor({ state:'detached' });
  assert.equal(reconcileCalls, 2);
  assert.equal(await page.locator('#vsmsMissingOrders').innerText(), '', 'resolved paid order leaves exception queue');
  console.log('PASS VSMS Boss paid-without-key alert and failure→retry recovery browser flow');
} finally { await browser.close(); server.close(); }
