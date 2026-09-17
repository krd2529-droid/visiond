import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const encoder = new TextEncoder(), join = parts => { const size = parts.reduce((sum, part) => sum + part.length, 0), output = new Uint8Array(size); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; }, header = (size, signature) => { const bytes = new Uint8Array(size); new DataView(bytes.buffer).setUint32(0, signature, true); return bytes; };
function storedZip(files) {
  const local = [], central = []; let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const fileName = encoder.encode(name), data = value instanceof Uint8Array ? value : encoder.encode(value), localHeader = header(30, 0x04034b50), localView = new DataView(localHeader.buffer); localView.setUint32(18, data.length, true); localView.setUint32(22, data.length, true); localView.setUint16(26, fileName.length, true); local.push(localHeader, fileName, data);
    const centralHeader = header(46, 0x02014b50), centralView = new DataView(centralHeader.buffer); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true); centralView.setUint16(28, fileName.length, true); centralView.setUint32(42, offset, true); central.push(centralHeader, fileName); offset += localHeader.length + fileName.length + data.length;
  }
  const directory = join(central), end = header(22, 0x06054b50), endView = new DataView(end.buffer), count = Object.keys(files).length; endView.setUint16(8, count, true); endView.setUint16(10, count, true); endView.setUint32(12, directory.length, true); endView.setUint32(16, offset, true); return join([...local, directory, end]);
}
const xml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), shape = value => `<p:sp><p:txBody><a:p><a:r><a:t>${xml(value)}</a:t></a:r></a:p></p:txBody></p:sp>`, picture = id => `<p:pic><p:blipFill><a:blip r:embed="${id}"/></p:blipFill></p:pic>`, slide = shapes => `<p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><p:cSld><p:spTree>${shapes.join('')}</p:spTree></p:cSld></p:sld>`;
const files = {};
for (let number = 1; number <= 68; number++) files[`ppt/slides/slide${number}.xml`] = slide([shape(number === 1 ? 'VISIOND' : `หัวข้อ ${number}`)]);
files['ppt/slides/slide4.xml'] = slide([shape('ขั้นตอนที่ 1'), shape('เข้าลิงก์ https://business.facebook.com/ แล้ว 1.1 กดสร้างแฟ้มทางธุรกิจ'), picture('r1'), shape('รูป 1 · กดเพื่อดูรูปใหญ่'), picture('r26'), shape('รูป 26 · กดเพื่อดูรูปใหญ่'), shape('4 / 68')]);
files['ppt/slides/slide19.xml'] = slide([shape('ขั้นตอนที่ 3'), shape('3.1 กดปุ่มเพิ่มสินค้า [ข้อมูลที่ต้องเติม: รูป 32]'), picture('r32'), shape('รูป 32 · กดเพื่อดูรูปใหญ่'), shape('19 / 68')]);
files['ppt/slides/slide21.xml'] = slide([shape('ขั้นตอนที่ 3'), shape('[ข้อมูลที่ต้องเติม: ขั้นตอนหรือภาพ รูป 35]'), picture('r35'), shape('รูป 35 · กดเพื่อดูรูปใหญ่'), shape('21 / 68')]);
files['ppt/slides/slide55.xml'] = slide([shape('รูป 32'), shape('3.1 กดปุ่มเพิ่มสินค้า [ข้อมูลที่ต้องเติม: รูป 32]'), picture('r32'), shape('55 / 68')]);
files['ppt/slides/slide58.xml'] = slide([shape('รูป 35'), shape('[ข้อมูลที่ต้องเติม: ขั้นตอนหรือภาพ รูป 35]'), picture('r35'), shape('58 / 68')]);
files['ppt/slides/slide67.xml'] = slide([shape('รูป 1'), shape('เข้าลิงก์ https://business.facebook.com/'), picture('r1'), shape('67 / 68')]);
files['ppt/slides/slide68.xml'] = slide([shape('รูป 26'), shape('1.1 กดสร้างแฟ้มทางธุรกิจ'), picture('r26'), shape('68 / 68')]);
files['ppt/slides/_rels/slide4.xml.rels'] = '<Relationships><Relationship Id="r1" Target="../media/image1.png"/><Relationship Id="r26" Target="../media/image26.png"/></Relationships>';
files['ppt/slides/_rels/slide19.xml.rels'] = '<Relationships><Relationship Id="r32" Target="../media/image32.png"/></Relationships>';
files['ppt/slides/_rels/slide21.xml.rels'] = '<Relationships><Relationship Id="r35" Target="../media/image35.png"/></Relationships>';
files['ppt/slides/_rels/slide55.xml.rels'] = '<Relationships><Relationship Id="r32" Target="../media/image32.png"/></Relationships>';
files['ppt/slides/_rels/slide58.xml.rels'] = '<Relationships><Relationship Id="r35" Target="../media/image35.png"/></Relationships>';
files['ppt/slides/_rels/slide67.xml.rels'] = '<Relationships><Relationship Id="r1" Target="../media/image1.png"/></Relationships>';
files['ppt/slides/_rels/slide68.xml.rels'] = '<Relationships><Relationship Id="r26" Target="../media/image26.png"/></Relationships>';
files['ppt/media/image1.png'] = new Uint8Array([137, 80, 78, 71, 1]); files['ppt/media/image26.png'] = new Uint8Array([137, 80, 78, 71, 26]);
files['ppt/media/image32.png'] = new Uint8Array([137, 80, 78, 71, 32]); files['ppt/media/image35.png'] = new Uint8Array([137, 80, 78, 71, 35]);
const pptx = storedZip(files), root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/api/powerpoints/2/preview') { response.writeHead(404, { 'content-type': 'application/json' }); response.end(JSON.stringify({ code: 'PREVIEW_NOT_AVAILABLE' })); return; }
  if (url.pathname === '/api/powerpoints/2') { response.writeHead(200, { 'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }); response.end(pptx); return; }
  const local = path.resolve(root, 'public', `.${url.pathname === '/' ? '/powerpoint-viewer.html' : url.pathname}`);
  if (!local.startsWith(path.resolve(root, 'public'))) { response.writeHead(403).end(); return; }
  try { const data = await readFile(local); response.writeHead(200, { 'content-type': path.extname(local) === '.js' ? 'text/javascript' : path.extname(local) === '.css' ? 'text/css' : 'text/html; charset=utf-8' }); response.end(data); } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const require = createRequire(import.meta.url); let chromium;
for (const candidate of ['C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright', 'playwright']) { try { ({ chromium } = require(candidate)); break; } catch {} }
assert.ok(chromium, 'installed Chrome via Playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'th-TH' });
  await page.goto(`http://127.0.0.1:${server.address().port}/powerpoint-viewer.html?id=2`);
  await page.waitForFunction(() => document.querySelector('#counter')?.textContent === '1 / 68');
  assert.equal(await page.locator('.thumb').count(), 68);
  assert.equal(await page.locator('#download').getAttribute('href'), '/api/powerpoints/2');
  const inventory = [];
  for (let expected = 1; expected <= 68; expected++) {
    inventory.push(await page.evaluate(() => ({ counter: document.querySelector('#counter')?.textContent, title: document.querySelector('#stage h1,#stage h2')?.textContent || '', captions: [...document.querySelectorAll('#stage figcaption')].map(node => node.textContent), alts: [...document.querySelectorAll('#stage img')].map(node => node.alt) })));
    assert.equal(inventory.at(-1).counter, `${expected} / 68`);
    if (expected < 68) await page.click('#next');
  }
  assert.deepEqual(inventory[3].alts, ['รูปประกอบลิงก์เริ่มต้น', 'รูป 1.1']);
  assert.deepEqual(inventory[3].captions, ['รูปประกอบลิงก์เริ่มต้น · กดเพื่อดูใหญ่', 'รูป 1.1 · กดเพื่อดูใหญ่']);
  assert.equal(new Set(inventory[3].alts).size, 2);
  assert.equal(inventory[66].title, 'รูปประกอบลิงก์เริ่มต้น');
  assert.equal(inventory[67].title, 'รูป 1.1');
  assert.deepEqual(inventory[18].alts, ['รูปประกอบที่ยังไม่ผูกขั้นตอน']);
  assert.deepEqual(inventory[20].alts, ['รูปประกอบที่ยังไม่ผูกขั้นตอน']);
  assert.equal(inventory[54].title, 'รูปประกอบที่ยังไม่ผูกขั้นตอน');
  assert.equal(inventory[57].title, 'รูปประกอบที่ยังไม่ผูกขั้นตอน');
} finally { await browser.close(); server.close(); }
console.log('PASS v0.20.121 installed Chrome 68-slide fallback navigation, semantic alt/caption/detail labels and unchanged download');
