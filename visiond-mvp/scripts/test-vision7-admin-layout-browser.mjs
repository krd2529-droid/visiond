import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [process.env.PLAYWRIGHT_PACKAGE,
  'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
  'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
if (!chromium) throw new Error('Playwright unavailable');

const css = readFileSync(new URL('../public/vision7.css', import.meta.url), 'utf8')
  .replace(/^@import[^\n]*\n/gm, '');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  await page.setContent(`<style>${css}</style><body class="v7-admin"><main class="wrap">
    <section class="key-workspace"><article id="programWorkspace" class="card program-panel">
      <header class="card-heading"><h2>โปรแกรม</h2></header>
      <div class="program-row"><div>VSMS · Android</div><div class="program-actions"><button>จัดการ</button></div></div>
    </article><article id="licenseWorkspace" class="card license-panel">ทุกคีย์ในระบบ</article></section>
    </main></body>`);
  for (const width of [1440, 1000, 800, 600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const rect = await page.evaluate(() => {
      const workspace = document.querySelector('.key-workspace').getBoundingClientRect();
      const program = document.querySelector('#programWorkspace').getBoundingClientRect();
      const licenses = document.querySelector('#licenseWorkspace').getBoundingClientRect();
      return { workspace: workspace.width, program: program.width,
        licenses: licenses.width, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(rect.program >= rect.workspace * .95,
      `program card uses its workspace at ${width}px: ${Math.round(rect.program)}/${Math.round(rect.workspace)}`);
    assert.ok(rect.licenses >= rect.workspace * .95, `license card stays readable at ${width}px`);
    assert.equal(rect.overflow, false, `no horizontal overflow at ${width}px`);
    if (width === 1000 && process.env.VISION7_LAYOUT_SCREENSHOT)
      await page.screenshot({ path: process.env.VISION7_LAYOUT_SCREENSHOT, fullPage: true });
  }
  assert.deepEqual(pageErrors, [], 'layout page has no browser console errors');
  console.log('PASS Vision7 programs and licenses fill workspace at desktop and mobile widths');
} finally { await browser.close(); }
