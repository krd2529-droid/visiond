import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { requestWorkNotesAI } from '../functions/_work-notes-ai.js';
import { fallbackDeck, normalizeDeck, parseDeckCandidate } from '../functions/api/admin/work-notes/presentation.js';

const validText = JSON.stringify({ deck_title: 'คู่มือ', slides: [{ title: 'ขั้นตอน', bullets: [{ text: 'กดเมนู [รูป 1]', attachment_numbers: [1] }] }] });
for (const wrapped of [
  validText,
  `\n\uFEFF${validText}\n`,
  `\`\`\`json\n${validText}\n\`\`\``,
  `\`\`\`JSON\r\n${validText}\r\n\`\`\``,
  `คำตอบที่จัดให้:\n${validText}\nจบคำตอบ`,
]) assert.equal(parseDeckCandidate(wrapped)?.slides?.length, 1);
assert.equal(parseDeckCandidate('{"slides":['), null);

const normalized = normalizeDeck(parseDeckCandidate(validText), 'คู่มือ', 'blue', 1, 'กดเมนู [รูป 1]');
assert.deepEqual(normalized.slides[0].bullets[0].attachment_numbers, [1]);
assert.equal(normalized.slides[0].bullets[0].text, 'กดเมนู');
assert.throws(() => normalizeDeck({ slides: [{ title: ' ', bullets: [] }] }, 'x', 'blue', 0, 'x'), /AI_INVALID_DECK/);

const fallback = fallbackDeck('คู่มือ', 'blue', 2, '1. เปิดหน้าแรก [รูป 1]\n2. กดปุ่มถัดไป [รูป 2]');
assert.equal(fallback.status, 'completed');
assert.deepEqual(fallback.slides[0].bullets.flatMap(item => item.attachment_numbers), [1, 2]);

const bundle = await readFile(new URL('../public/vendor/pptxgen.min.js', import.meta.url), 'utf8');
const context = { console, navigator: { userAgent: 'node' }, document: { createElement: () => ({ getContext: () => ({}) }) }, Blob, TextEncoder, TextDecoder, setTimeout, clearTimeout };
context.window = context; context.self = context; vm.createContext(context); vm.runInContext(bundle, context);
const pptx = new context.PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
const slide = pptx.addSlide();
slide.addText(fallback.deck_title, { x: 1, y: 1, w: 8, h: 1 });
slide.addText(fallback.slides[0].bullets.map(item => item.text).join('\n'), { x: 1, y: 2, w: 10, h: 3 });
const bytes = await pptx.write({ outputType: 'arraybuffer' });
const zip = await context.JSZip.loadAsync(bytes);
assert.ok(zip.file('[Content_Types].xml'));
assert.ok(zip.file('ppt/presentation.xml'));
assert.match(await zip.file('ppt/slides/slide1.xml').async('string'), /คู่มือ/);

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (_url, options) => {
  const key = options.headers['x-goog-api-key'];
  calls.push(key);
  if (key === 'bad') return Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"slides":[' }] } }] });
  await new Promise(resolve => setTimeout(resolve, 15));
  return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: validText }] } }] });
};
try {
  const result = await requestWorkNotesAI(
    { GEMINI_API_KEY: 'bad', GEMINI_API_KEY_2: 'good' },
    'prompt',
    { jsonMode: true, deadlineMs: 1000, validate: text => Boolean(parseDeckCandidate(text)?.slides?.length) },
  );
  assert.equal(result, validText);
  assert.ok(calls.includes('bad') && calls.includes('good'));
} finally {
  globalThis.fetch = originalFetch;
}

console.log('v0.14.622 invalid AI deck recovery checks passed');
