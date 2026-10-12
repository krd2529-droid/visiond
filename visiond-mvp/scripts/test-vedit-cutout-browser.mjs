import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { makeVeditZip, inspectVeditZip } from '../public/vedit-zip.js';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream' };
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const name = url.pathname === '/vedit' ? '/vedit.html' : url.pathname;
  const file = path.resolve(root, `.${name}`);
  if (path.relative(root, file).startsWith('..') || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  const headers = { 'content-type': types[path.extname(file)] || 'application/octet-stream' };
  if (name === '/vedit.html') headers['content-security-policy'] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; object-src 'none'";
  response.writeHead(200, headers);
  fs.createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage();
  page.on('console', message => { if (message.type() === 'error') console.error('browser:', message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/vedit`);
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f7f5ee'; ctx.fillRect(0, 0, 640, 640);
    ctx.fillStyle = '#222b3a'; ctx.fillRect(190, 90, 260, 470);
    ctx.fillStyle = '#d4ab45'; ctx.fillRect(205, 110, 230, 60);
    const file = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const { removeProductBackground } = await import('/vedit-cutout.js');
    const cutout = await removeProductBackground(file);
    const data = cutout.getContext('2d').getImageData(0, 0, 640, 640).data;
    const alpha = (x, y) => data[(y * 640 + x) * 4 + 3];
    return { corner: alpha(10, 10), product: alpha(320, 320), outer: alpha(620, 620), modelLoaded: true };
  });
  console.log(result);
  assert.equal(result.modelLoaded, true);
  assert.ok(result.corner < 80 && result.outer < 80, 'opaque background becomes transparent');
  assert.ok(result.product > 180, 'product remains opaque');
  const partialAlpha = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f7f5ee'; ctx.fillRect(0, 0, 640, 640);
    ctx.fillStyle = '#222b3a'; ctx.fillRect(190, 90, 260, 470);
    ctx.fillStyle = '#d4ab45'; ctx.fillRect(205, 110, 230, 60);
    ctx.clearRect(0, 0, 24, 24);
    const file = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const { removeProductBackground } = await import('/vedit-cutout.js');
    const cutout = await removeProductBackground(file);
    const data = cutout.getContext('2d').getImageData(0, 0, 640, 640).data;
    const alpha = (x, y) => data[(y * 640 + x) * 4 + 3];
    return { originalHole: alpha(10, 10), opaqueBackground: alpha(620, 620), product: alpha(320, 320) };
  });
  assert.ok(partialAlpha.originalHole < 16 && partialAlpha.opaqueBackground < 80 && partialAlpha.product > 180, `small transparent corner must not bypass background removal: ${JSON.stringify(partialAlpha)}`);
  const transparent = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 320;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#084f89'; ctx.fillRect(70, 40, 180, 240);
    const file = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const { removeProductBackground } = await import('/vedit-cutout.js');
    const cutout = await removeProductBackground(file), data = cutout.getContext('2d').getImageData(0, 0, 320, 320).data;
    return [data[3], data[(160 * 320 + 160) * 4 + 3]];
  });
  assert.deepEqual(transparent, [0, 255], 'existing transparent product alpha is preserved');

  async function zipFixture(width, height) {
    const base64 = await page.evaluate(({ width, height }) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f7f5ee'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#222b3a'; ctx.fillRect(width * .35, height * .12, width * .3, height * .75);
      ctx.fillStyle = '#d4ab45'; ctx.fillRect(width * .37, height * .15, width * .26, height * .1);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { width, height });
    const zip = await makeVeditZip([{ name: 'product.png', bytes: Buffer.from(base64, 'base64') }]);
    return Buffer.from(await zip.arrayBuffer());
  }

  for (const [width, height, selectedStyle] of [[640, 640, 'metal'], [800, 500, 'premium'], [480, 720, 'vintage']]) {
    await page.locator('#veditArchive').setInputFiles({ name: 'product.zip', mimeType: 'application/zip', buffer: await zipFixture(width, height) });
    await page.waitForFunction(() => document.querySelector('#veditStatus').dataset.state === 'success' && !document.querySelector('#veditDownload').disabled, { timeout: 30000 });
    for (const style of ['plain', 'metal', 'street', 'premium', 'vintage']) {
      await page.locator('#veditStyle').selectOption(style);
      await page.waitForFunction(key => document.querySelector('#veditCanvas').dataset.style === key && !document.querySelector('#veditDownload').disabled, style);
      const sample = await page.evaluate(async key => {
        const canvas = document.querySelector('#veditCanvas'), top = Number(canvas.dataset.topHeight), bottom = Number(canvas.dataset.bottomHeight), sourceHeight = Number(canvas.dataset.sourceHeight);
        const pixel = (context, x, y) => [...context.getImageData(x, y, 1, 1).data];
        const actual = pixel(canvas.getContext('2d'), 5, top + 5);
        if (key === 'plain') return { width: canvas.width, height: canvas.height, top, bottom, sourceHeight, actual, expected: [255, 255, 255, 255] };
        const background = new Image(); background.src = `/vedit-assets/${key}.png`; await background.decode();
        const expectedCanvas = document.createElement('canvas'); expectedCanvas.width = canvas.width; expectedCanvas.height = sourceHeight;
        const factor = Math.max(canvas.width / background.naturalWidth, sourceHeight / background.naturalHeight), cropWidth = canvas.width / factor, cropHeight = sourceHeight / factor;
        expectedCanvas.getContext('2d').drawImage(background, (background.naturalWidth - cropWidth) / 2, (background.naturalHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, sourceHeight);
        return { width: canvas.width, height: canvas.height, top, bottom, sourceHeight, actual, expected: pixel(expectedCanvas.getContext('2d'), 5, 5) };
      }, style);
      assert.equal(sample.width, width, `${style} keeps source width`);
      assert.equal(sample.sourceHeight, height, `${style} keeps source area height`);
      assert.equal(sample.height, height + sample.top + sample.bottom, `${style} adds bars outside source area`);
      assert.ok(sample.actual.slice(0, 3).every((channel, index) => Math.abs(channel - sample.expected[index]) < 3), `${style} uses centered cover crop at uncovered corner`);
    }
    await page.locator('#veditStyle').selectOption(selectedStyle);
    await page.waitForFunction(key => document.querySelector('#veditCanvas').dataset.style === key, selectedStyle);
    if (process.env.VEDIT_CAPTURE) await page.locator('#veditCanvas').screenshot({ path: process.env.VEDIT_CAPTURE.replace(/\.png$/, `-${selectedStyle}-${width}x${height}.png`) });
    const downloadPromise = page.waitForEvent('download'); await page.locator('#veditDownload').click(); const download = await downloadPromise;
    const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const exported = await inspectVeditZip(new File([Buffer.concat(chunks)], 'result.zip'));
    assert.equal(exported.entries.length, 1);
    const output = await exported.extract(exported.entries[0]);
    const exportedPixels = await page.evaluate(async bytes => {
      const image = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }));
      const preview = document.querySelector('#veditCanvas');
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; canvas.getContext('2d').drawImage(image, 0, 0);
      const points = [[4, 4], [4, Number(preview.dataset.topHeight) + 4], [image.width >> 1, image.height >> 1], [4, image.height - 4]];
      const read = (target, [x, y]) => [...target.getContext('2d').getImageData(x, y, 1, 1).data];
      return { width: image.width, height: image.height, samples: points.map(point => ({ point, output: read(canvas, point), preview: read(preview, point) })) };
    }, [...new Uint8Array(await output.arrayBuffer())]);
    assert.equal(exportedPixels.width, width);
    assert.ok(exportedPixels.samples.every(sample => sample.output.every((channel, index) => Math.abs(channel - sample.preview[index]) < 4)), `downloaded PNG matches preview pixels: ${JSON.stringify(exportedPixels.samples)}`);
  }

  const first = await inspectVeditZip(new File([await zipFixture(640, 640)], 'first.zip'));
  const second = await inspectVeditZip(new File([await zipFixture(800, 500)], 'second.zip'));
  const twoImages = await makeVeditZip([
    { name: 'first.png', bytes: await first.extract(first.entries[0]) },
    { name: 'second.png', bytes: await second.extract(second.entries[0]) }
  ]);
  await page.evaluate(() => {
    const create = document.createElement.bind(document);
    globalThis.__veditCanvases = [];
    document.createElement = function(name, ...args) { const node = create(name, ...args); if (String(name).toLowerCase() === 'canvas') globalThis.__veditCanvases.push(node); return node; };
  });
  await page.locator('#veditArchive').setInputFiles({ name: 'two.zip', mimeType: 'application/zip', buffer: Buffer.from(await twoImages.arrayBuffer()) });
  await page.waitForFunction(() => document.querySelector('#veditStatus').dataset.state === 'success');
  const firstRetained = await page.evaluate(() => globalThis.__veditCanvases.filter(node => node.width === 640 && node.height === 640).length);
  assert.equal(firstRetained, 1, 'visible preview retains exactly one cutout canvas');
  await page.locator('#veditArchivePreview').selectOption('1');
  await page.waitForFunction(() => document.querySelector('#veditCanvas').dataset.sourceWidth === '800');
  const replaced = await page.evaluate(() => globalThis.__veditCanvases.filter(node => node.width === 640 && node.height === 640).length);
  assert.equal(replaced, 0, 'replaced preview releases its cutout pixel buffer');
  const exportStart = await page.evaluate(() => globalThis.__veditCanvases.length);
  const batchDownload = page.waitForEvent('download'); await page.locator('#veditDownload').click(); await batchDownload;
  await page.waitForFunction(() => document.querySelector('#veditStatus').dataset.state === 'success' && document.querySelector('#veditCancel').hidden);
  const leaked = await page.evaluate(start => globalThis.__veditCanvases.slice(start).filter(node => node.width !== 0 || node.height !== 0).length, exportStart);
  assert.equal(leaked, 0, 'all cutout and intermediate canvases from batch export release their buffers');
  const visibleBeforeExit = await page.evaluate(() => globalThis.__veditCanvases.filter(node => node.width === 800 && node.height === 500).length);
  assert.equal(visibleBeforeExit, 1, 'current preview remains available after batch export');
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  const visibleAfterExit = await page.evaluate(() => globalThis.__veditCanvases.filter(node => node.width === 800 && node.height === 500).length);
  assert.equal(visibleAfterExit, 0, 'pagehide releases the visible cutout buffer');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log('Vedit real on-device cutout PASS');
